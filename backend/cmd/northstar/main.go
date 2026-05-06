package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rs/zerolog"

	"github.com/dbbaskette/northstar/internal/config"
	"github.com/dbbaskette/northstar/internal/database"
	"github.com/dbbaskette/northstar/internal/handler"
	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
	"github.com/dbbaskette/northstar/internal/static"
	"github.com/dbbaskette/northstar/internal/storage"
	"github.com/dbbaskette/northstar/internal/ws"
)

func main() {
	logger := zerolog.New(zerolog.ConsoleWriter{Out: os.Stdout, TimeFormat: time.RFC3339}).
		With().Timestamp().Caller().Logger()

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to load config")
	}

	lvl, _ := zerolog.ParseLevel(cfg.LogLevel)
	zerolog.SetGlobalLevel(lvl)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to connect to database")
	}
	defer pool.Close()

	logger.Info().Msg("connected to database")

	if os.Getenv("SKIP_MIGRATIONS") != "true" {
		if err := database.RunMigrations(pool); err != nil {
			logger.Fatal().Err(err).Msg("failed to run migrations")
		}
		logger.Info().Msg("migrations applied")
	}

	userRepo := repository.NewUserRepo(pool)
	teamRepo := repository.NewTeamRepo(pool)
	boardRepo := repository.NewBoardRepo(pool)
	listRepo := repository.NewListRepo(pool)
	cardRepo := repository.NewCardRepo(pool)
	commentRepo := repository.NewCommentRepo(pool)
	labelRepo := repository.NewLabelRepo(pool)
	activityRepo := repository.NewActivityRepo(pool)
	checklistRepo := repository.NewChecklistRepo(pool)
	attachmentRepo := repository.NewAttachmentRepo(pool)

	store, err := storage.NewFS(cfg.StoragePath)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to init storage backend")
	}
	logger.Info().Str("path", cfg.StoragePath).Msg("storage initialized")

	hub := ws.NewHub()
	go hub.Run()

	events := service.NewEvents(activityRepo, hub)
	authService := service.NewAuthService(userRepo, pool, cfg.JWTSecret)

	authHandler := handler.NewAuthHandler(authService)
	teamHandler := handler.NewTeamHandler(teamRepo)
	boardHandler := handler.NewBoardHandler(boardRepo, teamRepo)
	listHandler := handler.NewListHandler(listRepo, events)
	cardHandler := handler.NewCardHandler(cardRepo, listRepo, events)
	commentHandler := handler.NewCommentHandler(commentRepo, cardRepo, listRepo, events)
	labelHandler := handler.NewLabelHandler(labelRepo, cardRepo, listRepo, events)
	activityHandler := handler.NewActivityHandler(activityRepo)
	wsHandler := handler.NewWSHandler(hub, authService)
	checklistHandler := handler.NewChecklistHandler(checklistRepo, cardRepo, listRepo, events)
	attachmentHandler := handler.NewAttachmentHandler(attachmentRepo, cardRepo, listRepo, store, events)
	archiveHandler := handler.NewArchiveHandler(cardRepo, listRepo, events)

	r := chi.NewRouter()

	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(middleware.Logger(logger))
	r.Use(chimw.Recoverer)
	r.Use(cors.Handler(middleware.CORS()))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		if err := pool.Ping(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprintf(w, `{"status":"error","db":"disconnected"}`)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","db":"connected"}`)
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.Post("/auth/register", authHandler.Register)
		r.Post("/auth/login", authHandler.Login)
		r.Post("/auth/refresh", authHandler.Refresh)

		r.Get("/ws", wsHandler.Connect)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authService))

			r.Get("/auth/me", authHandler.Me)

			r.Route("/teams", func(r chi.Router) {
				r.Post("/", teamHandler.Create)
				r.Get("/", teamHandler.List)
				r.Route("/{teamId}", func(r chi.Router) {
					r.Get("/", teamHandler.Get)
					r.Patch("/", teamHandler.Update)
					r.Delete("/", teamHandler.Delete)
					r.Post("/members", teamHandler.AddMember)
					r.Delete("/members/{userId}", teamHandler.RemoveMember)
					r.Patch("/members/{userId}", teamHandler.UpdateMember)

					r.Post("/boards", boardHandler.Create)
					r.Get("/boards", boardHandler.ListByTeam)
				})
			})

			r.Route("/boards/{boardId}", func(r chi.Router) {
				r.Get("/", boardHandler.Get)
				r.Patch("/", boardHandler.Update)
				r.Delete("/", boardHandler.Delete)

				r.Post("/lists", listHandler.Create)
				r.Post("/labels", labelHandler.Create)
				r.Get("/activity", activityHandler.ListByBoard)
				r.Get("/archived", archiveHandler.ListArchived)
			})

			r.Route("/lists/{listId}", func(r chi.Router) {
				r.Patch("/", listHandler.Update)
				r.Delete("/", listHandler.Archive)
				r.Patch("/reorder", listHandler.Reorder)
				r.Post("/cards", cardHandler.Create)
				r.Post("/restore", archiveHandler.RestoreList)
				r.Delete("/permanent", archiveHandler.PermanentDeleteList)
			})

			r.Route("/cards/{cardId}", func(r chi.Router) {
				r.Get("/", cardHandler.Get)
				r.Patch("/", cardHandler.Update)
				r.Delete("/", cardHandler.Delete)
				r.Post("/restore", archiveHandler.RestoreCard)
				r.Delete("/permanent", archiveHandler.PermanentDeleteCard)
				r.Patch("/move", cardHandler.Move)
				r.Patch("/reorder", cardHandler.Reorder)

				r.Post("/labels", labelHandler.AttachToCard)
				r.Delete("/labels/{labelId}", labelHandler.DetachFromCard)
				r.Post("/assignees", labelHandler.AddAssignee)
				r.Delete("/assignees/{userId}", labelHandler.RemoveAssignee)
				r.Post("/comments", commentHandler.Create)
				r.Post("/checklists", checklistHandler.Create)
				r.Post("/attachments", attachmentHandler.Upload)
			})

			r.Route("/attachments/{attachmentId}", func(r chi.Router) {
				r.Get("/download", attachmentHandler.Download)
				r.Delete("/", attachmentHandler.Delete)
			})

			r.Route("/checklists/{checklistId}", func(r chi.Router) {
				r.Patch("/", checklistHandler.Update)
				r.Delete("/", checklistHandler.Delete)
				r.Post("/items", checklistHandler.CreateItem)
			})

			r.Route("/checklist-items/{itemId}", func(r chi.Router) {
				r.Patch("/", checklistHandler.UpdateItem)
				r.Delete("/", checklistHandler.DeleteItem)
				r.Patch("/reorder", checklistHandler.ReorderItem)
			})

			r.Route("/comments/{commentId}", func(r chi.Router) {
				r.Patch("/", commentHandler.Update)
				r.Delete("/", commentHandler.Delete)
			})

			r.Route("/labels/{labelId}", func(r chi.Router) {
				r.Patch("/", labelHandler.Update)
				r.Delete("/", labelHandler.Delete)
			})
		})
	})

	// Serve embedded frontend for any non-API route (SPA fallback).
	r.Handle("/*", static.Handler())

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		logger.Info().Int("port", cfg.Port).Msg("starting server")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal().Err(err).Msg("server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info().Msg("shutting down server")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Fatal().Err(err).Msg("server shutdown failed")
	}
	logger.Info().Msg("server stopped")
}

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

	// Bootstrap-admin promotion. Idempotent: if BOOTSTRAP_ADMIN_EMAIL
	// matches a user, set role='admin' + approve them. Skipped silently
	// if no user with that email exists (sign up first, then restage).
	if email := cfg.BootstrapAdminEmail; email != "" {
		bootstrapCtx, cancelBootstrap := context.WithTimeout(context.Background(), 5*time.Second)
		ct, err := pool.Exec(bootstrapCtx,
			`UPDATE users
			    SET role = 'admin',
			        approved_at = COALESCE(approved_at, NOW())
			  WHERE LOWER(email) = LOWER($1)`, email)
		cancelBootstrap()
		if err != nil {
			logger.Warn().Err(err).Str("email", email).Msg("bootstrap admin promotion failed")
		} else if ct.RowsAffected() > 0 {
			logger.Info().Str("email", email).Msg("bootstrap admin: user promoted")
		} else {
			logger.Info().Str("email", email).Msg("bootstrap admin: no matching user yet (register, then restage)")
		}
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
	searchRepo := repository.NewSearchRepo(pool)
	inviteRepo := repository.NewInviteRepo(pool)
	notifRepo := repository.NewNotificationRepo(pool)
	apiTokenRepo := repository.NewAPITokenRepo(pool)
	customFieldRepo := repository.NewCustomFieldRepo(pool)
	watcherRepo := repository.NewWatcherRepo(pool)
	reminderRepo := repository.NewReminderRepo(pool)
	webhookRepo := repository.NewWebhookRepo(pool)
	automationRepo := repository.NewAutomationRepo(pool)
	auditRepo := repository.NewAuditRepo(pool)
	reportRepo := repository.NewReportRepo(pool)
	voteRepo := repository.NewVoteRepo(pool)
	cardLinkRepo := repository.NewCardLinkRepo(pool)
	sessionRepo := repository.NewSessionRepo(pool)
	twofaRepo := repository.NewTwoFARepo(pool)
	pluginRepo := repository.NewPluginRepo(pool)
	workRepo := repository.NewWorkRepo(pool)

	store, err := storage.NewFS(cfg.StoragePath)
	if err != nil {
		logger.Fatal().Err(err).Msg("failed to init storage backend")
	}
	logger.Info().Str("path", cfg.StoragePath).Msg("storage initialized")

	hub := ws.NewHub()
	go hub.Run()

	webhookDispatcher := service.NewWebhookDispatcher(webhookRepo)
	go webhookDispatcher.Run(context.Background(), 10*time.Second)
	events := service.NewEvents(activityRepo, notifRepo, watcherRepo, hub, webhookDispatcher, nil)
	automationEngine := service.NewAutomationEngine(pool, automationRepo, cardRepo, labelRepo)
	events.SetAutomation(automationEngine)
	mentions := service.NewMentions(pool)
	cardCopier := service.NewCardCopier(pool)
	boardCopier := service.NewBoardCopier(pool)
	authService := service.NewAuthService(userRepo, pool, cfg.JWTSecret)
	authService.SetSessions(sessionRepo, twofaRepo)
	githubOAuth := service.NewGitHubOAuth(
		cfg.GitHubClientID, cfg.GitHubClientSecret, cfg.BaseURL, cfg.JWTSecret,
		userRepo, authService,
	)

	authHandler := handler.NewAuthHandler(authService, auditRepo)
	teamHandler := handler.NewTeamHandler(teamRepo, auditRepo)
	boardHandler := handler.NewBoardHandler(boardRepo, teamRepo, boardCopier, auditRepo, voteRepo, store)
	listHandler := handler.NewListHandler(listRepo, events, boardCopier)
	cardHandler := handler.NewCardHandler(cardRepo, listRepo, events, mentions, cardCopier)
	commentHandler := handler.NewCommentHandler(commentRepo, cardRepo, listRepo, events, mentions)
	labelHandler := handler.NewLabelHandler(labelRepo, cardRepo, listRepo, reminderRepo, events)
	activityHandler := handler.NewActivityHandler(activityRepo)
	wsHandler := handler.NewWSHandler(hub, authService, userRepo)
	checklistHandler := handler.NewChecklistHandler(checklistRepo, cardRepo, listRepo, events)
	attachmentHandler := handler.NewAttachmentHandler(attachmentRepo, cardRepo, listRepo, store, events)
	archiveHandler := handler.NewArchiveHandler(cardRepo, listRepo, events)
	searchHandler := handler.NewSearchHandler(searchRepo)
	userHandler := handler.NewUserHandler(userRepo, store)
	inviteHandler := handler.NewInviteHandler(inviteRepo, boardRepo, teamRepo)
	notifHandler := handler.NewNotificationHandler(notifRepo)
	apiTokenHandler := handler.NewAPITokenHandler(apiTokenRepo)
	customFieldHandler := handler.NewCustomFieldHandler(customFieldRepo, boardRepo)
	templateHandler := handler.NewTemplateHandler(pool, boardRepo, teamRepo, boardCopier)
	watcherHandler := handler.NewWatcherHandler(watcherRepo)
	reminderHandler := handler.NewReminderHandler(reminderRepo)
	webhookHandler := handler.NewWebhookHandler(webhookRepo, boardRepo)
	automationHandler := handler.NewAutomationHandler(automationRepo, boardRepo)
	auditHandler := handler.NewAuditHandler(auditRepo)
	ssoHandler := handler.NewSSOHandler(githubOAuth, auditRepo)
	adminUserHandler := handler.NewAdminUserHandler(userRepo, auditRepo)
	reportHandler := handler.NewReportHandler(reportRepo, boardRepo)
	voteHandler := handler.NewVoteHandler(voteRepo)
	cardLinkHandler := handler.NewCardLinkHandler(cardLinkRepo)
	securityHandler := handler.NewSecurityHandler(sessionRepo, twofaRepo, userRepo, cfg.JWTSecret)
	pluginHandler := handler.NewPluginHandler(pluginRepo, boardRepo)
	workHandler := handler.NewWorkHandler(workRepo)
	meBoardsHandler := handler.NewMeBoardsHandler(boardRepo)

	reminderWorker := service.NewReminderWorker(reminderRepo, events, 60*time.Second)
	go reminderWorker.Run(context.Background())

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
		r.Get("/auth/sso/providers", ssoHandler.Providers)
		r.Get("/auth/github/start", ssoHandler.GitHubStart)
		r.Get("/auth/github/callback", ssoHandler.GitHubCallback)

		r.Get("/invites/{token}", inviteHandler.Preview)
		r.Get("/ws", wsHandler.Connect)
		r.Get("/avatars/{userId}", userHandler.DownloadAvatar)
		r.Get("/boards/{boardId}/background", boardHandler.DownloadBackground)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Auth(authService, apiTokenRepo.LookupByToken))

			r.Group(func(r chi.Router) {
				r.Use(middleware.RequireAdmin(userRepo))
				r.Get("/admin/audit-log", auditHandler.List)
				r.Get("/admin/audit-log.csv", auditHandler.ExportCSV)
				r.Get("/admin/users", adminUserHandler.List)
				r.Patch("/admin/users/{userId}", adminUserHandler.Update)
				r.Delete("/admin/users/{userId}", adminUserHandler.Delete)
				r.Post("/admin/users/{userId}/approve", adminUserHandler.Approve)
				r.Post("/admin/users/{userId}/revoke-sessions", adminUserHandler.RevokeSessions)
				r.Post("/admin/users/bulk-role", adminUserHandler.BulkRole)

				r.Get("/admin/plugins", pluginHandler.List)
				r.Post("/admin/plugins", pluginHandler.Register)
				r.Delete("/admin/plugins/{pluginId}", pluginHandler.Unregister)
			})

			r.Get("/auth/me", authHandler.Me)
			r.Get("/me/work", workHandler.Mine)
			r.Get("/me/boards", meBoardsHandler.List)

			r.Route("/me/sessions", func(r chi.Router) {
				r.Get("/", securityHandler.ListSessions)
				r.Post("/{sessionId}/revoke", securityHandler.RevokeSession)
			})
			r.Route("/me/2fa", func(r chi.Router) {
				r.Get("/", securityHandler.TwoFAStatus)
				r.Post("/setup", securityHandler.TwoFASetup)
				r.Post("/verify", securityHandler.TwoFAVerify)
				r.Post("/disable", securityHandler.TwoFADisable)
			})

			r.Get("/search", searchHandler.Search)
			r.Get("/templates", templateHandler.ListTemplates)

			r.Route("/watch/{targetType}/{targetId}", func(r chi.Router) {
				r.Get("/", watcherHandler.IsWatching)
				r.Post("/", watcherHandler.Watch)
				r.Delete("/", watcherHandler.Unwatch)
			})

			r.Route("/notifications", func(r chi.Router) {
				r.Get("/", notifHandler.List)
				r.Get("/count", notifHandler.Count)
				r.Post("/read-all", notifHandler.MarkAllRead)
				r.Post("/{notificationId}/read", notifHandler.MarkRead)
			})

			r.Route("/auth/tokens", func(r chi.Router) {
				r.Get("/", apiTokenHandler.List)
				r.Post("/", apiTokenHandler.Create)
				r.Delete("/{tokenId}", apiTokenHandler.Delete)
			})

			r.Route("/users", func(r chi.Router) {
				r.Get("/", userHandler.List)
				r.Get("/me", userHandler.GetMe)
				r.Patch("/me", userHandler.UpdateProfile)
				r.Post("/me/avatar", userHandler.UploadAvatar)
				r.Patch("/{userId}", userHandler.UpdateProfileForUser)
			})

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
					r.Post("/boards/from-template", templateHandler.CreateFromTemplate)
				})
			})

			r.Route("/boards/{boardId}", func(r chi.Router) {
				r.Get("/", boardHandler.Get)
				r.Patch("/", boardHandler.Update)
				r.Delete("/", boardHandler.Delete)
				r.Patch("/visibility", boardHandler.UpdateVisibility)
				r.Patch("/stale-threshold", boardHandler.UpdateStaleThreshold)
				r.Post("/background", boardHandler.UploadBackground)
				r.Post("/copy", boardHandler.Copy)
				r.Patch("/template", templateHandler.ToggleTemplate)
				r.Get("/members", boardHandler.ListMembers)
				r.Post("/members", boardHandler.AddMember)
				r.Delete("/members/{userId}", boardHandler.RemoveMember)
				r.Post("/invites", inviteHandler.Create)
				r.Get("/invites", inviteHandler.List)

				r.Post("/lists", listHandler.Create)
				r.Post("/labels", labelHandler.Create)
				r.Get("/custom-fields", customFieldHandler.List)
				r.Post("/custom-fields", customFieldHandler.Create)
				r.Get("/webhooks", webhookHandler.List)
				r.Post("/webhooks", webhookHandler.Create)
				r.Get("/automations", automationHandler.List)
				r.Post("/automations", automationHandler.Create)
				r.Get("/activity", activityHandler.ListByBoard)
				r.Get("/reports", reportHandler.Board)
				r.Get("/plugins", pluginHandler.ListForBoard)
				r.Post("/plugins/{pluginId}", pluginHandler.Enable)
				r.Delete("/plugins/{pluginId}", pluginHandler.Disable)
				r.Get("/archived", archiveHandler.ListArchived)
			})

			r.Route("/lists/{listId}", func(r chi.Router) {
				r.Patch("/", listHandler.Update)
				r.Delete("/", listHandler.Archive)
				r.Patch("/reorder", listHandler.Reorder)
				r.Post("/copy", listHandler.Copy)
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
				r.Patch("/cover", cardHandler.SetCover)
				r.Patch("/priority", cardHandler.SetPriority)
				r.Post("/copy", cardHandler.Copy)
				r.Post("/move-to", cardHandler.MoveToList)
				r.Post("/vote", voteHandler.Add)
				r.Delete("/vote", voteHandler.Remove)
				r.Get("/links", cardLinkHandler.List)
				r.Post("/links", cardLinkHandler.Create)

				r.Post("/labels", labelHandler.AttachToCard)
				r.Delete("/labels/{labelId}", labelHandler.DetachFromCard)
				r.Post("/assignees", labelHandler.AddAssignee)
				r.Delete("/assignees/{userId}", labelHandler.RemoveAssignee)
				r.Post("/comments", commentHandler.Create)
				r.Post("/checklists", checklistHandler.Create)
				r.Post("/attachments", attachmentHandler.Upload)
				r.Get("/reminders", reminderHandler.List)
				r.Post("/reminders", reminderHandler.Create)
				r.Put("/custom-fields/{fieldId}", customFieldHandler.SetCardValue)
			})

			r.Delete("/reminders/{reminderId}", reminderHandler.Delete)

			r.Route("/webhooks/{webhookId}", func(r chi.Router) {
				r.Delete("/", webhookHandler.Delete)
				r.Get("/deliveries", webhookHandler.Deliveries)
			})

			r.Route("/automations/{ruleId}", func(r chi.Router) {
				r.Patch("/", automationHandler.Update)
				r.Delete("/", automationHandler.Delete)
				r.Get("/runs", automationHandler.Runs)
			})

			r.Route("/custom-fields/{fieldId}", func(r chi.Router) {
				r.Patch("/", customFieldHandler.Update)
				r.Delete("/", customFieldHandler.Delete)
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

			r.Delete("/links/{linkId}", cardLinkHandler.Delete)

			r.Route("/comments/{commentId}", func(r chi.Router) {
				r.Patch("/", commentHandler.Update)
				r.Delete("/", commentHandler.Delete)
				r.Post("/reactions/{emoji}", commentHandler.ToggleReaction)
			})

			r.Post("/invites/{token}/accept", inviteHandler.Accept)
			r.Delete("/invites/{inviteId}", inviteHandler.Delete)

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

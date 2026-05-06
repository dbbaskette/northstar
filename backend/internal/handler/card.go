package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type CardHandler struct {
	cardRepo *repository.CardRepo
	listRepo *repository.ListRepo
	events   *service.Events
	mentions *service.Mentions
}

func NewCardHandler(cardRepo *repository.CardRepo, listRepo *repository.ListRepo, events *service.Events, mentions *service.Mentions) *CardHandler {
	return &CardHandler{cardRepo: cardRepo, listRepo: listRepo, events: events, mentions: mentions}
}

type createCardRequest struct {
	Title string `json:"title"`
}

type updateCardRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	DueDate     *string `json:"due_date"`
	Priority    *string `json:"priority"`
	Completed   *bool   `json:"completed"`
}

type moveCardRequest struct {
	ListID   string  `json:"list_id"`
	Position float64 `json:"position"`
}

type reorderCardRequest struct {
	Position float64 `json:"position"`
}

type setCoverRequest struct {
	AttachmentID *string `json:"attachment_id"`
	Color        *string `json:"color"`
	Size         *string `json:"size"`
}

func (h *CardHandler) boardIDForList(ctx context.Context, listID string) string {
	list, err := h.listRepo.FindByID(ctx, listID)
	if err != nil {
		return ""
	}
	return uuidStr(list.BoardID)
}

func (h *CardHandler) boardIDForCard(ctx context.Context, cardID string) string {
	card, err := h.cardRepo.FindByID(ctx, cardID)
	if err != nil {
		return ""
	}
	return h.boardIDForList(ctx, uuidStr(card.ListID))
}

func (h *CardHandler) Create(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	var req createCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	var lid, uid pgtype.UUID
	lid.Scan(listID)
	uid.Scan(userID)

	card := &models.Card{
		ListID:    lid,
		Title:     req.Title,
		CreatedBy: uid,
	}

	if err := h.cardRepo.Create(r.Context(), card); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForList(r.Context(), listID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.created", "card", uuidStr(card.ID), map[string]interface{}{
			"card_id": uuidStr(card.ID),
			"list_id": listID,
			"title":   card.Title,
		})
	}

	writeJSON(w, http.StatusCreated, card)
}

func (h *CardHandler) Get(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")

	card, err := h.cardRepo.GetCardWithDetails(r.Context(), cardID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, card)
}

func (h *CardHandler) Update(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req updateCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var dueDate *time.Time
	if req.DueDate != nil && *req.DueDate != "" {
		t, err := time.Parse(time.RFC3339, *req.DueDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid due_date format, use RFC3339")
			return
		}
		dueDate = &t
	}

	if req.Priority != nil && *req.Priority != "" {
		switch *req.Priority {
		case "low", "medium", "high", "urgent":
			// valid
		default:
			writeError(w, http.StatusBadRequest, "priority must be one of: low, medium, high, urgent")
			return
		}
	}

	if err := h.cardRepo.Update(r.Context(), cardID, repository.CardUpdate{
		Title:       req.Title,
		Description: req.Description,
		DueDate:     dueDate,
		Priority:    req.Priority,
		Completed:   req.Completed,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r.Context(), cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.updated", "card", cardID, map[string]interface{}{
			"card_id": cardID,
			"title":   req.Title,
		})

		// Notify users mentioned in the description
		if h.mentions != nil && req.Description != "" {
			usernames := h.mentions.Extract(req.Description)
			if mentionedIDs, err := h.mentions.Resolve(r.Context(), usernames); err == nil && len(mentionedIDs) > 0 {
				h.events.Notify(r.Context(), mentionedIDs, userID, "mention", cardID, boardID, map[string]interface{}{
					"card_id":    cardID,
					"card_title": req.Title,
					"in":         "description",
				})
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *CardHandler) Delete(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	boardID := h.boardIDForCard(r.Context(), cardID)

	if err := h.cardRepo.Delete(r.Context(), cardID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.deleted", "card", cardID, map[string]interface{}{
			"card_id": cardID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *CardHandler) Move(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req moveCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.cardRepo.Move(r.Context(), cardID, req.ListID, req.Position); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForList(r.Context(), req.ListID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.moved", "card", cardID, map[string]interface{}{
			"card_id":     cardID,
			"to_list_id":  req.ListID,
			"position":    req.Position,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "moved"})
}

func (h *CardHandler) SetCover(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req setCoverRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Size != nil && *req.Size != "" && *req.Size != "half" && *req.Size != "full" {
		writeError(w, http.StatusBadRequest, "size must be 'half', 'full', or empty")
		return
	}

	if err := h.cardRepo.SetCover(r.Context(), cardID, repository.CoverUpdate{
		AttachmentID: req.AttachmentID,
		Color:        req.Color,
		Size:         req.Size,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r.Context(), cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.cover_updated", "card", cardID, map[string]interface{}{
			"card_id": cardID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *CardHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req reorderCardRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.cardRepo.Reorder(r.Context(), cardID, req.Position); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r.Context(), cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "card.reordered", "card", cardID, map[string]interface{}{
			"card_id":  cardID,
			"position": req.Position,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

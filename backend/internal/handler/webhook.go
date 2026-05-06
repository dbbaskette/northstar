package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type WebhookHandler struct {
	hookRepo  *repository.WebhookRepo
	boardRepo *repository.BoardRepo
}

func NewWebhookHandler(hookRepo *repository.WebhookRepo, boardRepo *repository.BoardRepo) *WebhookHandler {
	return &WebhookHandler{hookRepo: hookRepo, boardRepo: boardRepo}
}

type createWebhookRequest struct {
	URL          string   `json:"url"`
	EventFilters []string `json:"event_filters"`
}

func (h *WebhookHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can manage webhooks")
		return
	}

	var req createWebhookRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}

	hook, err := h.hookRepo.Create(r.Context(), boardID, req.URL, userID, req.EventFilters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, hook)
}

func (h *WebhookHandler) List(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can view webhooks")
		return
	}

	hooks, err := h.hookRepo.ListByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if hooks == nil {
		hooks = []repository.Webhook{}
	}
	writeJSON(w, http.StatusOK, hooks)
}

func (h *WebhookHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "webhookId")
	if err := h.hookRepo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *WebhookHandler) Deliveries(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "webhookId")
	deliveries, err := h.hookRepo.ListDeliveries(r.Context(), id, 25)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if deliveries == nil {
		deliveries = []repository.WebhookDelivery{}
	}
	writeJSON(w, http.StatusOK, deliveries)
}

package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type CardLinkHandler struct {
	repo *repository.CardLinkRepo
}

func NewCardLinkHandler(repo *repository.CardLinkRepo) *CardLinkHandler {
	return &CardLinkHandler{repo: repo}
}

func (h *CardLinkHandler) List(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	links, err := h.repo.ForCard(r.Context(), cardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"links": links})
}

type createLinkRequest struct {
	ToCardID     string `json:"to_card_id"`
	RelationType string `json:"relation_type"`
}

func (h *CardLinkHandler) Create(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req createLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	if req.ToCardID == "" || req.RelationType == "" {
		writeError(w, http.StatusBadRequest, "to_card_id and relation_type are required")
		return
	}
	link, err := h.repo.Create(r.Context(), cardID, req.ToCardID, req.RelationType, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, link)
}

func (h *CardLinkHandler) Delete(w http.ResponseWriter, r *http.Request) {
	linkID := chi.URLParam(r, "linkId")
	if err := h.repo.Delete(r.Context(), linkID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

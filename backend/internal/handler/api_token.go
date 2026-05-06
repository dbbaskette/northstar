package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type APITokenHandler struct {
	tokenRepo *repository.APITokenRepo
}

func NewAPITokenHandler(tokenRepo *repository.APITokenRepo) *APITokenHandler {
	return &APITokenHandler{tokenRepo: tokenRepo}
}

type createTokenRequest struct {
	Name          string `json:"name"`
	ExpiresInDays int    `json:"expires_in_days"`
}

func (h *APITokenHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req createTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	tok, err := h.tokenRepo.Create(r.Context(), userID, req.Name, req.ExpiresInDays)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, tok)
}

func (h *APITokenHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	tokens, err := h.tokenRepo.ListByUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tokens == nil {
		tokens = []repository.APIToken{}
	}
	writeJSON(w, http.StatusOK, tokens)
}

func (h *APITokenHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	id := chi.URLParam(r, "tokenId")
	if err := h.tokenRepo.Delete(r.Context(), id, userID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

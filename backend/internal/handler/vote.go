package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type VoteHandler struct {
	voteRepo *repository.VoteRepo
}

func NewVoteHandler(voteRepo *repository.VoteRepo) *VoteHandler {
	return &VoteHandler{voteRepo: voteRepo}
}

func (h *VoteHandler) Add(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())
	if err := h.voteRepo.Add(r.Context(), cardID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	count, _ := h.voteRepo.CountByCard(r.Context(), cardID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vote_count":   count,
		"viewer_voted": true,
	})
}

func (h *VoteHandler) Remove(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())
	if err := h.voteRepo.Remove(r.Context(), cardID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	count, _ := h.voteRepo.CountByCard(r.Context(), cardID)
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"vote_count":   count,
		"viewer_voted": false,
	})
}

package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type CommentHandler struct {
	commentRepo *repository.CommentRepo
	cardRepo    *repository.CardRepo
	listRepo    *repository.ListRepo
	events      *service.Events
}

func NewCommentHandler(
	commentRepo *repository.CommentRepo,
	cardRepo *repository.CardRepo,
	listRepo *repository.ListRepo,
	events *service.Events,
) *CommentHandler {
	return &CommentHandler{
		commentRepo: commentRepo,
		cardRepo:    cardRepo,
		listRepo:    listRepo,
		events:      events,
	}
}

type createCommentRequest struct {
	Body string `json:"body"`
}

func (h *CommentHandler) Create(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Body == "" {
		writeError(w, http.StatusBadRequest, "body is required")
		return
	}

	var cid, uid pgtype.UUID
	cid.Scan(cardID)
	uid.Scan(userID)

	comment := &models.Comment{
		CardID: cid,
		UserID: uid,
		Body:   req.Body,
	}

	if err := h.commentRepo.Create(r.Context(), comment); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if card, err := h.cardRepo.FindByID(r.Context(), cardID); err == nil {
		if list, err := h.listRepo.FindByID(r.Context(), uuidStr(card.ListID)); err == nil {
			h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "comment.added", "comment", uuidStr(comment.ID), map[string]interface{}{
				"card_id":    cardID,
				"comment_id": uuidStr(comment.ID),
			})
		}
	}

	writeJSON(w, http.StatusCreated, comment)
}

func (h *CommentHandler) Update(w http.ResponseWriter, r *http.Request) {
	commentID := chi.URLParam(r, "commentId")

	var req createCommentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.commentRepo.Update(r.Context(), commentID, req.Body); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *CommentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	commentID := chi.URLParam(r, "commentId")

	if err := h.commentRepo.Delete(r.Context(), commentID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

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

	if card, err := h.cardRepo.GetCardWithDetails(r.Context(), cardID); err == nil {
		if list, err := h.listRepo.FindByID(r.Context(), uuidStr(card.ListID)); err == nil {
			boardID := uuidStr(list.BoardID)
			payload := map[string]interface{}{
				"card_id":    cardID,
				"card_title": card.Title,
				"comment_id": uuidStr(comment.ID),
				"body":       comment.Body,
			}
			h.events.Emit(r.Context(), boardID, userID, "comment.added", "comment", uuidStr(comment.ID), payload)

			// Notify all card assignees about the new comment
			recipients := make([]string, 0, len(card.Assignees))
			for _, a := range card.Assignees {
				recipients = append(recipients, uuidStr(a.ID))
			}
			h.events.Notify(r.Context(), recipients, userID, "comment.added", cardID, boardID, payload)
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

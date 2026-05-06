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

type LabelHandler struct {
	labelRepo *repository.LabelRepo
	cardRepo  *repository.CardRepo
	listRepo  *repository.ListRepo
	events    *service.Events
}

func NewLabelHandler(
	labelRepo *repository.LabelRepo,
	cardRepo *repository.CardRepo,
	listRepo *repository.ListRepo,
	events *service.Events,
) *LabelHandler {
	return &LabelHandler{
		labelRepo: labelRepo,
		cardRepo:  cardRepo,
		listRepo:  listRepo,
		events:    events,
	}
}

type createLabelRequest struct {
	Name  string `json:"name"`
	Color string `json:"color"`
}

type attachLabelRequest struct {
	LabelID string `json:"label_id"`
}

type addAssigneeRequest struct {
	UserID string `json:"user_id"`
}

func (h *LabelHandler) cardBoardID(r *http.Request, cardID string) string {
	card, err := h.cardRepo.FindByID(r.Context(), cardID)
	if err != nil {
		return ""
	}
	list, err := h.listRepo.FindByID(r.Context(), uuidStr(card.ListID))
	if err != nil {
		return ""
	}
	return uuidStr(list.BoardID)
}

func (h *LabelHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	var req createLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.Color == "" {
		writeError(w, http.StatusBadRequest, "name and color are required")
		return
	}

	var bid pgtype.UUID
	bid.Scan(boardID)

	label := &models.Label{
		BoardID: bid,
		Name:    req.Name,
		Color:   req.Color,
	}

	if err := h.labelRepo.Create(r.Context(), label); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, label)
}

func (h *LabelHandler) Update(w http.ResponseWriter, r *http.Request) {
	labelID := chi.URLParam(r, "labelId")

	var req createLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.labelRepo.Update(r.Context(), labelID, req.Name, req.Color); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *LabelHandler) Delete(w http.ResponseWriter, r *http.Request) {
	labelID := chi.URLParam(r, "labelId")

	if err := h.labelRepo.Delete(r.Context(), labelID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *LabelHandler) AttachToCard(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req attachLabelRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.labelRepo.AttachToCard(r.Context(), cardID, req.LabelID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.cardBoardID(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "label.attached", "card", cardID, map[string]interface{}{
			"card_id":  cardID,
			"label_id": req.LabelID,
		})
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "label attached"})
}

func (h *LabelHandler) DetachFromCard(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	labelID := chi.URLParam(r, "labelId")
	userID := middleware.GetUserID(r.Context())

	if err := h.labelRepo.DetachFromCard(r.Context(), cardID, labelID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.cardBoardID(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "label.detached", "card", cardID, map[string]interface{}{
			"card_id":  cardID,
			"label_id": labelID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "label detached"})
}

func (h *LabelHandler) AddAssignee(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req addAssigneeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.labelRepo.AddAssignee(r.Context(), cardID, req.UserID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.cardBoardID(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "assignee.added", "card", cardID, map[string]interface{}{
			"card_id": cardID,
			"user_id": req.UserID,
		})
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "assignee added"})
}

func (h *LabelHandler) RemoveAssignee(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	memberID := chi.URLParam(r, "userId")
	userID := middleware.GetUserID(r.Context())

	if err := h.labelRepo.RemoveAssignee(r.Context(), cardID, memberID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.cardBoardID(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "assignee.removed", "card", cardID, map[string]interface{}{
			"card_id": cardID,
			"user_id": memberID,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "assignee removed"})
}

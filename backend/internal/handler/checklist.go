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

type ChecklistHandler struct {
	checklistRepo *repository.ChecklistRepo
	cardRepo      *repository.CardRepo
	listRepo      *repository.ListRepo
	events        *service.Events
}

func NewChecklistHandler(
	cl *repository.ChecklistRepo,
	cr *repository.CardRepo,
	lr *repository.ListRepo,
	events *service.Events,
) *ChecklistHandler {
	return &ChecklistHandler{checklistRepo: cl, cardRepo: cr, listRepo: lr, events: events}
}

type createChecklistRequest struct {
	Title string `json:"title"`
}

type updateChecklistRequest struct {
	Title string `json:"title"`
}

type createItemRequest struct {
	Text string `json:"text"`
}

type updateItemRequest struct {
	Text       *string `json:"text"`
	IsComplete *bool   `json:"is_complete"`
}

type reorderItemRequest struct {
	Position float64 `json:"position"`
}

func (h *ChecklistHandler) boardIDForCard(r *http.Request, cardID string) string {
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

func (h *ChecklistHandler) boardIDForChecklist(r *http.Request, checklistID string) (string, string) {
	cl, err := h.checklistRepo.FindByID(r.Context(), checklistID)
	if err != nil {
		return "", ""
	}
	cardID := uuidStr(cl.CardID)
	return h.boardIDForCard(r, cardID), cardID
}

func (h *ChecklistHandler) Create(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req createChecklistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Title == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	var cid pgtype.UUID
	cid.Scan(cardID)

	cl := &models.Checklist{CardID: cid, Title: req.Title}
	if err := h.checklistRepo.Create(r.Context(), cl); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "checklist.created", "checklist",
			uuidStr(cl.ID), map[string]interface{}{"card_id": cardID, "title": cl.Title})
	}

	writeJSON(w, http.StatusCreated, cl)
}

func (h *ChecklistHandler) Update(w http.ResponseWriter, r *http.Request) {
	checklistID := chi.URLParam(r, "checklistId")
	userID := middleware.GetUserID(r.Context())

	var req updateChecklistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.checklistRepo.Update(r.Context(), checklistID, req.Title); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID, cardID := h.boardIDForChecklist(r, checklistID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "checklist.updated", "checklist",
			checklistID, map[string]interface{}{"card_id": cardID, "title": req.Title})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *ChecklistHandler) Delete(w http.ResponseWriter, r *http.Request) {
	checklistID := chi.URLParam(r, "checklistId")
	userID := middleware.GetUserID(r.Context())

	boardID, cardID := h.boardIDForChecklist(r, checklistID)

	if err := h.checklistRepo.Delete(r.Context(), checklistID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "checklist.deleted", "checklist",
			checklistID, map[string]interface{}{"card_id": cardID})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ChecklistHandler) CreateItem(w http.ResponseWriter, r *http.Request) {
	checklistID := chi.URLParam(r, "checklistId")
	userID := middleware.GetUserID(r.Context())

	var req createItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Text == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	var clid pgtype.UUID
	clid.Scan(checklistID)

	item := &models.ChecklistItem{ChecklistID: clid, Text: req.Text}
	if err := h.checklistRepo.CreateItem(r.Context(), item); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID, cardID := h.boardIDForChecklist(r, checklistID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "checklist.item_added", "checklist_item",
			uuidStr(item.ID), map[string]interface{}{"card_id": cardID, "checklist_id": checklistID})
	}

	writeJSON(w, http.StatusCreated, item)
}

func (h *ChecklistHandler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")
	userID := middleware.GetUserID(r.Context())

	var req updateItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.checklistRepo.UpdateItem(r.Context(), itemID, repository.ItemUpdate{
		Text:       req.Text,
		IsComplete: req.IsComplete,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Best-effort broadcast (need to walk item -> checklist -> card -> board)
	if userID != "" {
		// Skip path lookup for performance; client refetches via WS
		_ = userID
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *ChecklistHandler) DeleteItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")

	if err := h.checklistRepo.DeleteItem(r.Context(), itemID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *ChecklistHandler) ReorderItem(w http.ResponseWriter, r *http.Request) {
	itemID := chi.URLParam(r, "itemId")

	var req reorderItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.checklistRepo.ReorderItem(r.Context(), itemID, req.Position); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

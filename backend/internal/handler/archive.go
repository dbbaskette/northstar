package handler

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type ArchiveHandler struct {
	cardRepo *repository.CardRepo
	listRepo *repository.ListRepo
	events   *service.Events
}

func NewArchiveHandler(cardRepo *repository.CardRepo, listRepo *repository.ListRepo, events *service.Events) *ArchiveHandler {
	return &ArchiveHandler{cardRepo: cardRepo, listRepo: listRepo, events: events}
}

// ListArchived returns all archived lists and cards for a board.
func (h *ArchiveHandler) ListArchived(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")

	lists, err := h.listRepo.ListArchivedByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if lists == nil {
		lists = []models.List{}
	}

	cards, err := h.cardRepo.ListArchivedByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if cards == nil {
		cards = []models.Card{}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"lists": lists,
		"cards": cards,
	})
}

// RestoreCard clears deleted_at on a card.
func (h *ArchiveHandler) RestoreCard(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	if err := h.cardRepo.Restore(r.Context(), cardID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	if card, err := h.cardRepo.FindByID(r.Context(), cardID); err == nil {
		if list, err := h.listRepo.FindByID(r.Context(), uuidStr(card.ListID)); err == nil {
			h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "card.restored", "card",
				cardID, map[string]interface{}{"card_id": cardID})
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

// PermanentDeleteCard hard-deletes a card and cascades.
func (h *ArchiveHandler) PermanentDeleteCard(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")

	if err := h.cardRepo.PermanentDelete(r.Context(), cardID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// RestoreList clears is_archived on a list.
func (h *ArchiveHandler) RestoreList(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	if err := h.listRepo.Restore(r.Context(), listID); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	if list, err := h.listRepo.FindByID(r.Context(), listID); err == nil {
		h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "list.restored", "list",
			listID, map[string]interface{}{"list_id": listID})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

// PermanentDeleteList hard-deletes a list and cascades.
func (h *ArchiveHandler) PermanentDeleteList(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")

	if err := h.listRepo.PermanentDelete(r.Context(), listID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

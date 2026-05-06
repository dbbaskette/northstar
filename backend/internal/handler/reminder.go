package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type ReminderHandler struct {
	reminderRepo *repository.ReminderRepo
}

func NewReminderHandler(reminderRepo *repository.ReminderRepo) *ReminderHandler {
	return &ReminderHandler{reminderRepo: reminderRepo}
}

type createReminderRequest struct {
	LeadMinutes int  `json:"lead_minutes"`
	JustMe      bool `json:"just_me"` // when true, reminder targets only the actor
}

func (h *ReminderHandler) Create(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	var req createReminderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.LeadMinutes < 0 {
		writeError(w, http.StatusBadRequest, "lead_minutes must be non-negative")
		return
	}

	target := ""
	if req.JustMe {
		target = userID
	}

	if err := h.reminderRepo.Create(r.Context(), cardID, target, req.LeadMinutes); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"status": "created"})
}

func (h *ReminderHandler) List(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	rs, err := h.reminderRepo.ListByCard(r.Context(), cardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if rs == nil {
		rs = []repository.Reminder{}
	}
	writeJSON(w, http.StatusOK, rs)
}

func (h *ReminderHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "reminderId")
	if err := h.reminderRepo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

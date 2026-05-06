package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type AutomationHandler struct {
	rules     *repository.AutomationRepo
	boardRepo *repository.BoardRepo
}

func NewAutomationHandler(rules *repository.AutomationRepo, boardRepo *repository.BoardRepo) *AutomationHandler {
	return &AutomationHandler{rules: rules, boardRepo: boardRepo}
}

type ruleRequest struct {
	Name    string          `json:"name"`
	Trigger json.RawMessage `json:"trigger"`
	Actions json.RawMessage `json:"actions"`
	Enabled bool            `json:"enabled"`
}

func (h *AutomationHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can manage automation")
		return
	}

	var req ruleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || len(req.Trigger) == 0 || len(req.Actions) == 0 {
		writeError(w, http.StatusBadRequest, "name, trigger, and actions are required")
		return
	}

	rule, err := h.rules.Create(r.Context(), boardID, req.Name, userID, req.Trigger, req.Actions, req.Enabled)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, rule)
}

func (h *AutomationHandler) List(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || role == "" {
		writeError(w, http.StatusForbidden, "no access")
		return
	}

	rules, err := h.rules.ListByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if rules == nil {
		rules = []repository.AutomationRule{}
	}
	writeJSON(w, http.StatusOK, rules)
}

func (h *AutomationHandler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "ruleId")
	var req ruleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.rules.Update(r.Context(), id, req.Name, req.Trigger, req.Actions, req.Enabled); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *AutomationHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "ruleId")
	if err := h.rules.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *AutomationHandler) Runs(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "ruleId")
	runs, err := h.rules.ListRuns(r.Context(), id, 25)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if runs == nil {
		runs = []repository.AutomationRun{}
	}
	writeJSON(w, http.StatusOK, runs)
}

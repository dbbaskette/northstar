package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type CustomFieldHandler struct {
	fieldRepo *repository.CustomFieldRepo
	boardRepo *repository.BoardRepo
}

func NewCustomFieldHandler(fieldRepo *repository.CustomFieldRepo, boardRepo *repository.BoardRepo) *CustomFieldHandler {
	return &CustomFieldHandler{fieldRepo: fieldRepo, boardRepo: boardRepo}
}

type createFieldRequest struct {
	Name        string          `json:"name"`
	Type        string          `json:"type"`
	Options     json.RawMessage `json:"options"`
	ShowOnFront bool            `json:"show_on_front"`
}

type updateFieldRequest struct {
	Name        string          `json:"name"`
	Options     json.RawMessage `json:"options"`
	ShowOnFront bool            `json:"show_on_front"`
}

type setValueRequest struct {
	Value json.RawMessage `json:"value"`
}

func (h *CustomFieldHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can manage custom fields")
		return
	}

	var req createFieldRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	switch req.Type {
	case "text", "number", "date", "checkbox", "dropdown":
	default:
		writeError(w, http.StatusBadRequest, "type must be text/number/date/checkbox/dropdown")
		return
	}

	def, err := h.fieldRepo.CreateDef(r.Context(), boardID, req.Name, req.Type, req.Options, req.ShowOnFront)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, def)
}

func (h *CustomFieldHandler) List(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	if role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID); err != nil || role == "" {
		writeError(w, http.StatusForbidden, "no access")
		return
	}

	defs, err := h.fieldRepo.ListDefsByBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if defs == nil {
		defs = []repository.CustomFieldDef{}
	}
	writeJSON(w, http.StatusOK, defs)
}

func (h *CustomFieldHandler) Update(w http.ResponseWriter, r *http.Request) {
	fieldID := chi.URLParam(r, "fieldId")

	var req updateFieldRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.fieldRepo.UpdateDef(r.Context(), fieldID, req.Name, req.Options, req.ShowOnFront); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *CustomFieldHandler) Delete(w http.ResponseWriter, r *http.Request) {
	fieldID := chi.URLParam(r, "fieldId")
	if err := h.fieldRepo.DeleteDef(r.Context(), fieldID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

func (h *CustomFieldHandler) SetCardValue(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	fieldID := chi.URLParam(r, "fieldId")

	var req setValueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.fieldRepo.SetValue(r.Context(), cardID, fieldID, req.Value); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

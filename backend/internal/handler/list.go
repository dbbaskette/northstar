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

type ListHandler struct {
	listRepo *repository.ListRepo
	events   *service.Events
	copier   *service.BoardCopier
}

func NewListHandler(listRepo *repository.ListRepo, events *service.Events, copier *service.BoardCopier) *ListHandler {
	return &ListHandler{listRepo: listRepo, events: events, copier: copier}
}

type createListRequest struct {
	Name string `json:"name"`
}

type reorderListRequest struct {
	Position float64 `json:"position"`
}

func (h *ListHandler) Create(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	var req createListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	var bid pgtype.UUID
	bid.Scan(boardID)

	list := &models.List{
		BoardID: bid,
		Name:    req.Name,
	}

	if err := h.listRepo.Create(r.Context(), list); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.events.Emit(r.Context(), boardID, userID, "list.created", "list", uuidStr(list.ID), map[string]interface{}{
		"list_id": uuidStr(list.ID),
		"name":    list.Name,
	})

	writeJSON(w, http.StatusCreated, list)
}

func (h *ListHandler) Update(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	var req createListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.listRepo.Update(r.Context(), listID, req.Name); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if list, err := h.listRepo.FindByID(r.Context(), listID); err == nil {
		h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "list.updated", "list", listID, map[string]interface{}{
			"list_id": listID,
			"name":    req.Name,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

func (h *ListHandler) Archive(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	list, err := h.listRepo.FindByID(r.Context(), listID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	if err := h.listRepo.Archive(r.Context(), listID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "list.archived", "list", listID, map[string]interface{}{
		"list_id": listID,
	})

	writeJSON(w, http.StatusOK, map[string]string{"status": "archived"})
}

func (h *ListHandler) Copy(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	newID, err := h.copier.CopyList(r.Context(), listID, userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if list, err := h.listRepo.FindByID(r.Context(), newID); err == nil {
		h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "list.copied", "list", newID, map[string]interface{}{
			"list_id":        newID,
			"source_list_id": listID,
		})
	}

	writeJSON(w, http.StatusCreated, map[string]string{"list_id": newID})
}

func (h *ListHandler) Reorder(w http.ResponseWriter, r *http.Request) {
	listID := chi.URLParam(r, "listId")
	userID := middleware.GetUserID(r.Context())

	var req reorderListRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.listRepo.Reorder(r.Context(), listID, req.Position); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if list, err := h.listRepo.FindByID(r.Context(), listID); err == nil {
		h.events.Emit(r.Context(), uuidStr(list.BoardID), userID, "list.reordered", "list", listID, map[string]interface{}{
			"list_id":  listID,
			"position": req.Position,
		})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

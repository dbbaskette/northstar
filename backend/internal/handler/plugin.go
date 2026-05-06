package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type PluginHandler struct {
	repo      *repository.PluginRepo
	boardRepo *repository.BoardRepo
}

func NewPluginHandler(repo *repository.PluginRepo, boardRepo *repository.BoardRepo) *PluginHandler {
	return &PluginHandler{repo: repo, boardRepo: boardRepo}
}

// List (admin) returns every registered plugin.
func (h *PluginHandler) List(w http.ResponseWriter, r *http.Request) {
	plugins, err := h.repo.ListAll(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugins": plugins})
}

type registerPluginRequest struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	ManifestURL  string   `json:"manifest_url"`
	IframeURL    string   `json:"iframe_url"`
	Version      string   `json:"version"`
	Capabilities []string `json:"capabilities"`
}

// Register (admin) installs a plugin into the workspace registry.
func (h *PluginHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerPluginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid body")
		return
	}
	p, err := h.repo.Create(r.Context(), repository.PluginInsert{
		Name:         req.Name,
		Description:  req.Description,
		ManifestURL:  req.ManifestURL,
		IframeURL:    req.IframeURL,
		Version:      req.Version,
		Capabilities: req.Capabilities,
		CreatedBy:    middleware.GetUserID(r.Context()),
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, p)
}

// Unregister (admin) — also cascades to board_plugins via FK.
func (h *PluginHandler) Unregister(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "pluginId")
	if err := h.repo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ListForBoard returns plugins enabled on a board.
func (h *PluginHandler) ListForBoard(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	plugins, err := h.repo.ListForBoard(r.Context(), boardID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"plugins": plugins})
}

func (h *PluginHandler) Enable(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	pluginID := chi.URLParam(r, "pluginId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can manage plugins")
		return
	}
	if err := h.repo.Enable(r.Context(), boardID, pluginID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "enabled"})
}

func (h *PluginHandler) Disable(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	pluginID := chi.URLParam(r, "pluginId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can manage plugins")
		return
	}
	if err := h.repo.Disable(r.Context(), boardID, pluginID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "disabled"})
}

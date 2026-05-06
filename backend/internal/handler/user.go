package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/storage"
)

const maxAvatarSize = 5 * 1024 * 1024 // 5MB

type UserHandler struct {
	userRepo *repository.UserRepo
	store    storage.Backend
}

func NewUserHandler(userRepo *repository.UserRepo, store storage.Backend) *UserHandler {
	return &UserHandler{userRepo: userRepo, store: store}
}

type updateProfileRequest struct {
	DisplayName string `json:"display_name"`
	Bio         string `json:"bio"`
	Timezone    string `json:"timezone"`
}

func (h *UserHandler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	user, err := h.userRepo.FindByID(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) List(w http.ResponseWriter, r *http.Request) {
	users, err := h.userRepo.List(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, users)
}

func (h *UserHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.DisplayName == "" {
		writeError(w, http.StatusBadRequest, "display_name is required")
		return
	}

	if err := h.userRepo.UpdateProfile(r.Context(), userID, repository.ProfileUpdate{
		DisplayName: req.DisplayName,
		Bio:         req.Bio,
		Timezone:    req.Timezone,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	user, _ := h.userRepo.FindByID(r.Context(), userID)
	writeJSON(w, http.StatusOK, user)
}

func (h *UserHandler) UploadAvatar(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())

	if err := r.ParseMultipartForm(maxAvatarSize); err != nil {
		writeError(w, http.StatusBadRequest, "request too large or invalid")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing 'file' field")
		return
	}
	defer file.Close()

	if header.Size > maxAvatarSize {
		writeError(w, http.StatusRequestEntityTooLarge, "avatar exceeds max 5MB")
		return
	}
	mime := header.Header.Get("Content-Type")
	if !strings.HasPrefix(mime, "image/") {
		writeError(w, http.StatusBadRequest, "avatar must be an image")
		return
	}

	storageKey := fmt.Sprintf("avatars/%s%s", userID, filenameExt(header.Filename))
	if _, err := h.store.Put(storageKey, io.LimitReader(file, maxAvatarSize)); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store avatar")
		return
	}

	url := "/api/v1/avatars/" + userID
	if err := h.userRepo.UpdateProfile(r.Context(), userID, repository.ProfileUpdate{
		AvatarURL: &url,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	user, _ := h.userRepo.FindByID(r.Context(), userID)
	writeJSON(w, http.StatusOK, user)
}

// DownloadAvatar streams an avatar by user_id. Public endpoint (no auth)
// so avatars can be referenced from <img src="/api/v1/avatars/...">.
func (h *UserHandler) DownloadAvatar(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "userId")

	user, err := h.userRepo.FindByID(r.Context(), userID)
	if err != nil || !user.AvatarURL.Valid {
		http.NotFound(w, r)
		return
	}

	// Try common extensions; the storage key was generated from the upload's filename
	for _, ext := range []string{".png", ".jpg", ".jpeg", ".gif", ".webp", ""} {
		key := fmt.Sprintf("avatars/%s%s", userID, ext)
		rc, err := h.store.Open(key)
		if err == nil {
			defer rc.Close()
			w.Header().Set("Content-Type", contentTypeForExt(ext))
			w.Header().Set("Cache-Control", "private, max-age=300")
			io.Copy(w, rc)
			return
		}
	}

	http.NotFound(w, r)
}

// UpdateProfileForUser allows updating a different user — restricted to
// the user themselves. Used by the user-profile API client.
func (h *UserHandler) UpdateProfileForUser(w http.ResponseWriter, r *http.Request) {
	targetID := chi.URLParam(r, "userId")
	currentID := middleware.GetUserID(r.Context())

	if targetID != currentID {
		writeError(w, http.StatusForbidden, "you can only update your own profile")
		return
	}
	h.UpdateProfile(w, r)
}

func filenameExt(filename string) string {
	if i := strings.LastIndex(filename, "."); i >= 0 {
		return strings.ToLower(filename[i:])
	}
	return ""
}

func contentTypeForExt(ext string) string {
	switch strings.ToLower(ext) {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	}
	return "application/octet-stream"
}

package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
	"github.com/dbbaskette/northstar/internal/storage"
)

const maxUploadSize = 25 * 1024 * 1024 // 25MB

type AttachmentHandler struct {
	attachmentRepo *repository.AttachmentRepo
	cardRepo       *repository.CardRepo
	listRepo       *repository.ListRepo
	store          storage.Backend
	events         *service.Events
}

func NewAttachmentHandler(
	ar *repository.AttachmentRepo,
	cr *repository.CardRepo,
	lr *repository.ListRepo,
	store storage.Backend,
	events *service.Events,
) *AttachmentHandler {
	return &AttachmentHandler{
		attachmentRepo: ar,
		cardRepo:       cr,
		listRepo:       lr,
		store:          store,
		events:         events,
	}
}

type addUrlRequest struct {
	URL  string `json:"url"`
	Name string `json:"name"`
}

func (h *AttachmentHandler) boardIDForCard(r *http.Request, cardID string) string {
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

// Upload handles POST /cards/:cardId/attachments. Two modes:
//   - multipart/form-data with a "file" field → file upload
//   - application/json with {url, name} → URL attachment
func (h *AttachmentHandler) Upload(w http.ResponseWriter, r *http.Request) {
	cardID := chi.URLParam(r, "cardId")
	userID := middleware.GetUserID(r.Context())

	contentType := r.Header.Get("Content-Type")

	if strings.HasPrefix(contentType, "application/json") {
		h.uploadURL(w, r, cardID, userID)
		return
	}

	if !strings.HasPrefix(contentType, "multipart/form-data") {
		writeError(w, http.StatusBadRequest, "expected multipart/form-data or application/json")
		return
	}

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "request too large or invalid")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing 'file' field")
		return
	}
	defer file.Close()

	if header.Size > maxUploadSize {
		writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("file exceeds max %d bytes", maxUploadSize))
		return
	}

	storageKey := storage.NewKey(cardID, header.Filename)
	written, err := h.store.Put(storageKey, io.LimitReader(file, maxUploadSize))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store file")
		return
	}

	var cid, uid pgtype.UUID
	cid.Scan(cardID)
	uid.Scan(userID)

	att := &models.Attachment{
		CardID:     cid,
		UploaderID: uid,
		Kind:       "file",
		Filename:   header.Filename,
		MimeType:   pgtype.Text{String: header.Header.Get("Content-Type"), Valid: true},
		SizeBytes:  pgtype.Int8{Int64: written, Valid: true},
		StorageKey: pgtype.Text{String: storageKey, Valid: true},
	}

	if err := h.attachmentRepo.Create(r.Context(), att); err != nil {
		_ = h.store.Delete(storageKey) // best-effort rollback
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "attachment.added", "attachment",
			uuidStr(att.ID), map[string]interface{}{
				"card_id":  cardID,
				"filename": att.Filename,
			})
	}

	writeJSON(w, http.StatusCreated, att)
}

func (h *AttachmentHandler) uploadURL(w http.ResponseWriter, r *http.Request, cardID, userID string) {
	var req addUrlRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "url is required")
		return
	}
	if !strings.HasPrefix(req.URL, "http://") && !strings.HasPrefix(req.URL, "https://") {
		writeError(w, http.StatusBadRequest, "url must start with http(s)://")
		return
	}
	name := req.Name
	if name == "" {
		name = req.URL
	}

	var cid, uid pgtype.UUID
	cid.Scan(cardID)
	uid.Scan(userID)

	att := &models.Attachment{
		CardID:     cid,
		UploaderID: uid,
		Kind:       "url",
		Filename:   name,
		URL:        pgtype.Text{String: req.URL, Valid: true},
	}

	if err := h.attachmentRepo.Create(r.Context(), att); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r, cardID); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "attachment.added", "attachment",
			uuidStr(att.ID), map[string]interface{}{
				"card_id":  cardID,
				"filename": att.Filename,
			})
	}

	writeJSON(w, http.StatusCreated, att)
}

// Download streams a file attachment back to the client.
func (h *AttachmentHandler) Download(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "attachmentId")

	att, err := h.attachmentRepo.FindByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if att.Kind != "file" || !att.StorageKey.Valid {
		writeError(w, http.StatusBadRequest, "attachment is not a file")
		return
	}

	rc, err := h.store.Open(att.StorageKey.String)
	if err != nil {
		writeError(w, http.StatusNotFound, "file missing on disk")
		return
	}
	defer rc.Close()

	if att.MimeType.Valid {
		w.Header().Set("Content-Type", att.MimeType.String)
	} else {
		w.Header().Set("Content-Type", "application/octet-stream")
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, att.Filename))
	if att.SizeBytes.Valid {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", att.SizeBytes.Int64))
	}
	io.Copy(w, rc)
}

func (h *AttachmentHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "attachmentId")
	userID := middleware.GetUserID(r.Context())

	att, err := h.attachmentRepo.FindByID(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, "attachment not found")
		return
	}

	if att.Kind == "file" && att.StorageKey.Valid {
		if err := h.store.Delete(att.StorageKey.String); err != nil && !errors.Is(err, io.EOF) {
			// log but continue with DB delete
		}
	}

	if err := h.attachmentRepo.Delete(r.Context(), id); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if boardID := h.boardIDForCard(r, uuidStr(att.CardID)); boardID != "" {
		h.events.Emit(r.Context(), boardID, userID, "attachment.removed", "attachment",
			id, map[string]interface{}{
				"card_id":  uuidStr(att.CardID),
				"filename": att.Filename,
			})
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

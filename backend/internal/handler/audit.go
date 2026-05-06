package handler

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/dbbaskette/northstar/internal/repository"
)

type AuditHandler struct {
	repo *repository.AuditRepo
}

func NewAuditHandler(repo *repository.AuditRepo) *AuditHandler {
	return &AuditHandler{repo: repo}
}

func (h *AuditHandler) parseFilter(r *http.Request) repository.AuditFilter {
	q := r.URL.Query()
	f := repository.AuditFilter{
		ActorID: q.Get("actor"),
		Action:  q.Get("action"),
	}
	if l, _ := strconv.Atoi(q.Get("limit")); l > 0 {
		f.Limit = l
	}
	if o, _ := strconv.Atoi(q.Get("offset")); o > 0 {
		f.Offset = o
	}
	if from := q.Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			f.From = &t
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			f.To = &t
		}
	}
	return f
}

func (h *AuditHandler) List(w http.ResponseWriter, r *http.Request) {
	entries, err := h.repo.List(r.Context(), h.parseFilter(r))
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	actions, _ := h.repo.DistinctActions(r.Context())
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"entries": entries,
		"actions": actions,
	})
}

// ExportCSV streams the same filtered set as List() but as CSV. Filenames
// include the day so admins can drop several months of exports into a folder.
func (h *AuditHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	f := h.parseFilter(r)
	if f.Limit == 0 {
		f.Limit = 500
	}
	entries, err := h.repo.List(r.Context(), f)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set(
		"Content-Disposition",
		`attachment; filename="northstar-audit-`+time.Now().UTC().Format("20060102")+`.csv"`,
	)
	c := csv.NewWriter(w)
	defer c.Flush()
	_ = c.Write([]string{"created_at", "actor_email", "actor_name", "action", "target_type", "target_id", "ip", "user_agent", "metadata"})
	for _, e := range entries {
		var metaStr string
		if len(e.Metadata) > 0 {
			metaStr = string(e.Metadata)
		}
		_ = c.Write([]string{
			e.CreatedAt.UTC().Format(time.RFC3339),
			e.ActorEmail, e.ActorName,
			e.Action, e.TargetType, e.TargetID,
			e.IP, e.UserAgent, metaStr,
		})
	}
}

// Decoded is used by the frontend so callers don't need to JSON.parse the
// raw metadata blob client-side. Not used here directly but kept to clarify
// payload shape.
type entryView struct {
	repository.AuditEntry
	MetadataObj json.RawMessage `json:"metadata_obj,omitempty"`
}

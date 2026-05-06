package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/repository"
)

type SearchHandler struct {
	searchRepo *repository.SearchRepo
}

func NewSearchHandler(searchRepo *repository.SearchRepo) *SearchHandler {
	return &SearchHandler{searchRepo: searchRepo}
}

func (h *SearchHandler) Search(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	query := strings.TrimSpace(r.URL.Query().Get("q"))

	if len(query) < 2 {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"query":   query,
			"results": []interface{}{},
		})
		return
	}

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}

	hits, err := h.searchRepo.Search(r.Context(), userID, query, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if hits == nil {
		hits = []repository.SearchHit{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"query":   query,
		"results": hits,
	})
}

package handler

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/middleware"
	"github.com/dbbaskette/northstar/internal/models"
	"github.com/dbbaskette/northstar/internal/repository"
	"github.com/dbbaskette/northstar/internal/service"
)

type TemplateHandler struct {
	pool      *pgxpool.Pool
	boardRepo *repository.BoardRepo
	teamRepo  *repository.TeamRepo
	copier    *service.BoardCopier
}

func NewTemplateHandler(
	pool *pgxpool.Pool,
	boardRepo *repository.BoardRepo,
	teamRepo *repository.TeamRepo,
	copier *service.BoardCopier,
) *TemplateHandler {
	return &TemplateHandler{pool: pool, boardRepo: boardRepo, teamRepo: teamRepo, copier: copier}
}

// BuiltInTemplate captures a starter board structure that we can spin up
// from scratch (no source board needed).
type BuiltInTemplate struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Background  string   `json:"background"`
	Lists       []string `json:"lists"`
	Labels      []struct {
		Name  string `json:"name"`
		Color string `json:"color"`
	} `json:"labels"`
}

var builtInTemplates = []BuiltInTemplate{
	{
		ID: "kanban", Name: "Kanban", Description: "Classic Kanban with three columns.",
		Background: "#0079BF",
		Lists:      []string{"To Do", "In Progress", "Done"},
		Labels: []struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}{
			{"Bug", "#EB5A46"}, {"Feature", "#61BD4F"}, {"Chore", "#C377E0"},
		},
	},
	{
		ID: "sprint", Name: "Sprint Planning", Description: "Sprint backlog → in progress → review → done.",
		Background: "#519839",
		Lists:      []string{"Backlog", "Sprint", "In Progress", "Review", "Done"},
		Labels: []struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}{
			{"Bug", "#EB5A46"}, {"Story", "#61BD4F"}, {"Tech debt", "#F2D600"}, {"Blocked", "#FF9F1A"},
		},
	},
	{
		ID: "editorial", Name: "Editorial Calendar", Description: "Ideas → drafting → review → published.",
		Background: "#D29034",
		Lists:      []string{"Ideas", "Drafting", "Review", "Scheduled", "Published"},
		Labels: []struct {
			Name  string `json:"name"`
			Color string `json:"color"`
		}{
			{"Blog", "#0079BF"}, {"Newsletter", "#C377E0"}, {"Social", "#FF9F1A"},
		},
	},
	{
		ID: "retro", Name: "Retro", Description: "What went well / what didn't / actions.",
		Background: "#89609E",
		Lists:      []string{"What went well", "What didn't", "Action items"},
	},
}

func (h *TemplateHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	userTemplates, err := h.boardRepo.ListTemplatesForUser(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if userTemplates == nil {
		userTemplates = []models.Board{}
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"built_in":      builtInTemplates,
		"user_defined":  userTemplates,
	})
}

func (h *TemplateHandler) ToggleTemplate(w http.ResponseWriter, r *http.Request) {
	boardID := chi.URLParam(r, "boardId")
	userID := middleware.GetUserID(r.Context())

	role, err := h.boardRepo.AccessibleByUser(r.Context(), boardID, userID)
	if err != nil || (role != "owner" && role != "admin") {
		writeError(w, http.StatusForbidden, "only board admins can toggle template status")
		return
	}

	var req struct {
		IsTemplate bool `json:"is_template"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	if err := h.boardRepo.SetTemplate(r.Context(), boardID, req.IsTemplate); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"is_template": req.IsTemplate,
	})
}

type createFromTemplateRequest struct {
	TemplateID    string `json:"template_id"`     // built-in id like "kanban"
	SourceBoardID string `json:"source_board_id"` // existing user template
	Name          string `json:"name"`
	Background    string `json:"background"`
}

// CreateFromTemplate creates a new board on the team. Either template_id
// (built-in) or source_board_id (user template) must be supplied.
func (h *TemplateHandler) CreateFromTemplate(w http.ResponseWriter, r *http.Request) {
	teamID := chi.URLParam(r, "teamId")
	userID := middleware.GetUserID(r.Context())

	if _, err := h.teamRepo.GetMemberRole(r.Context(), teamID, userID); err != nil {
		writeError(w, http.StatusForbidden, "not a team member")
		return
	}

	var req createFromTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	// Source: an existing user template
	if req.SourceBoardID != "" {
		newID, err := h.copier.CopyBoard(r.Context(), req.SourceBoardID, userID, req.Name)
		if err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// New board inherits the source's team — re-team it if needed
		if _, err := h.pool.Exec(r.Context(),
			`UPDATE boards SET team_id = $2, is_template = FALSE WHERE id = $1`,
			newID, teamID); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"board_id": newID})
		return
	}

	// Source: a built-in template
	tpl := findBuiltIn(req.TemplateID)
	if tpl == nil {
		writeError(w, http.StatusBadRequest, "unknown template_id")
		return
	}
	background := tpl.Background
	if req.Background != "" {
		background = req.Background
	}

	newID, err := buildFromBuiltIn(r.Context(), h.pool, teamID, userID, req.Name, background, tpl)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, map[string]string{"board_id": newID})
}

func findBuiltIn(id string) *BuiltInTemplate {
	for i := range builtInTemplates {
		if builtInTemplates[i].ID == id {
			return &builtInTemplates[i]
		}
	}
	return nil
}

func buildFromBuiltIn(
	ctx context.Context,
	pool *pgxpool.Pool,
	teamID, userID, name, background string,
	tpl *BuiltInTemplate,
) (string, error) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var newBoardID string
	if err := tx.QueryRow(ctx, `
		INSERT INTO boards (team_id, name, description, background, created_by)
		VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
		teamID, name, tpl.Description, background, userID,
	).Scan(&newBoardID); err != nil {
		return "", err
	}

	for i, listName := range tpl.Lists {
		pos := float64((i + 1) * 1024)
		if _, err := tx.Exec(ctx,
			`INSERT INTO lists (board_id, name, position) VALUES ($1, $2, $3)`,
			newBoardID, listName, pos); err != nil {
			return "", err
		}
	}
	for _, l := range tpl.Labels {
		if _, err := tx.Exec(ctx,
			`INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3)`,
			newBoardID, l.Name, l.Color); err != nil {
			return "", err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return newBoardID, nil
}

package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Plugin struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Description  string          `json:"description"`
	ManifestURL  string          `json:"manifest_url"`
	IframeURL    string          `json:"iframe_url"`
	Version      string          `json:"version"`
	Capabilities json.RawMessage `json:"capabilities"`
	CreatedAt    time.Time       `json:"created_at"`
}

type BoardPlugin struct {
	BoardID   string          `json:"board_id"`
	PluginID  string          `json:"plugin_id"`
	Plugin    *Plugin         `json:"plugin,omitempty"`
	Config    json.RawMessage `json:"config"`
	EnabledAt time.Time       `json:"enabled_at"`
}

type PluginRepo struct {
	pool *pgxpool.Pool
}

func NewPluginRepo(pool *pgxpool.Pool) *PluginRepo {
	return &PluginRepo{pool: pool}
}

type PluginInsert struct {
	Name         string
	Description  string
	ManifestURL  string
	IframeURL    string
	Version      string
	Capabilities []string
	CreatedBy    string
}

func (r *PluginRepo) Create(ctx context.Context, in PluginInsert) (*Plugin, error) {
	if in.Name == "" || in.IframeURL == "" {
		return nil, fmt.Errorf("name and iframe_url are required")
	}
	if in.Version == "" {
		in.Version = "1.0.0"
	}
	caps, _ := json.Marshal(in.Capabilities)
	p := &Plugin{}
	err := r.pool.QueryRow(ctx, `
		INSERT INTO plugins (name, description, manifest_url, iframe_url, version, capabilities, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, '')::uuid)
		RETURNING id::text, name, description, manifest_url, iframe_url, version, capabilities, created_at`,
		in.Name, in.Description, in.ManifestURL, in.IframeURL, in.Version, caps, in.CreatedBy,
	).Scan(&p.ID, &p.Name, &p.Description, &p.ManifestURL, &p.IframeURL, &p.Version, &p.Capabilities, &p.CreatedAt)
	return p, err
}

func (r *PluginRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM plugins WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("plugin not found")
	}
	return nil
}

func (r *PluginRepo) ListAll(ctx context.Context) ([]Plugin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id::text, name, COALESCE(description, ''), manifest_url, iframe_url,
		       version, capabilities, created_at
		FROM plugins ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Plugin{}
	for rows.Next() {
		var p Plugin
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.ManifestURL,
			&p.IframeURL, &p.Version, &p.Capabilities, &p.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *PluginRepo) Enable(ctx context.Context, boardID, pluginID string) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO board_plugins (board_id, plugin_id) VALUES ($1, $2)
		ON CONFLICT (board_id, plugin_id) DO NOTHING`, boardID, pluginID)
	return err
}

func (r *PluginRepo) Disable(ctx context.Context, boardID, pluginID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM board_plugins WHERE board_id = $1 AND plugin_id = $2`,
		boardID, pluginID)
	return err
}

func (r *PluginRepo) ListForBoard(ctx context.Context, boardID string) ([]BoardPlugin, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT bp.board_id::text, bp.plugin_id::text, bp.config, bp.enabled_at,
		       p.name, COALESCE(p.description, ''), p.manifest_url, p.iframe_url,
		       p.version, p.capabilities, p.created_at
		FROM board_plugins bp
		JOIN plugins p ON p.id = bp.plugin_id
		WHERE bp.board_id = $1
		ORDER BY p.name`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []BoardPlugin{}
	for rows.Next() {
		var bp BoardPlugin
		p := &Plugin{}
		if err := rows.Scan(&bp.BoardID, &bp.PluginID, &bp.Config, &bp.EnabledAt,
			&p.Name, &p.Description, &p.ManifestURL, &p.IframeURL,
			&p.Version, &p.Capabilities, &p.CreatedAt); err != nil {
			return nil, err
		}
		p.ID = bp.PluginID
		bp.Plugin = p
		out = append(out, bp)
	}
	return out, rows.Err()
}

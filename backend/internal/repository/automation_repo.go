package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AutomationRepo struct {
	pool *pgxpool.Pool
}

func NewAutomationRepo(pool *pgxpool.Pool) *AutomationRepo {
	return &AutomationRepo{pool: pool}
}

type AutomationRule struct {
	ID        pgtype.UUID     `json:"id"`
	BoardID   pgtype.UUID     `json:"board_id"`
	Name      string          `json:"name"`
	Trigger   json.RawMessage `json:"trigger"`
	Actions   json.RawMessage `json:"actions"`
	Enabled   bool            `json:"enabled"`
	CreatedBy pgtype.UUID     `json:"created_by"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type AutomationRun struct {
	ID     pgtype.UUID `json:"id"`
	RuleID pgtype.UUID `json:"rule_id"`
	Status string      `json:"status"`
	Log    pgtype.Text `json:"log,omitempty"`
	RanAt  time.Time   `json:"ran_at"`
}

func (r *AutomationRepo) Create(ctx context.Context, boardID, name, createdBy string, trigger, actions json.RawMessage, enabled bool) (*AutomationRule, error) {
	rule := &AutomationRule{
		Name:    name,
		Trigger: trigger,
		Actions: actions,
		Enabled: enabled,
	}
	rule.BoardID.Scan(boardID)
	rule.CreatedBy.Scan(createdBy)

	err := r.pool.QueryRow(ctx, `
		INSERT INTO automation_rules (board_id, name, trigger, actions, enabled, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`,
		boardID, name, trigger, actions, enabled, createdBy,
	).Scan(&rule.ID, &rule.CreatedAt, &rule.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return rule, nil
}

func (r *AutomationRepo) ListByBoard(ctx context.Context, boardID string) ([]AutomationRule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, board_id, name, trigger, actions, enabled, created_by, created_at, updated_at
		FROM automation_rules WHERE board_id = $1 ORDER BY created_at DESC`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AutomationRule
	for rows.Next() {
		var rule AutomationRule
		if err := rows.Scan(&rule.ID, &rule.BoardID, &rule.Name, &rule.Trigger, &rule.Actions,
			&rule.Enabled, &rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, rule)
	}
	return out, rows.Err()
}

// MatchingForBoard returns enabled rules on the board. The engine
// filters in-memory by event type and trigger conditions.
func (r *AutomationRepo) MatchingForBoard(ctx context.Context, boardID string) ([]AutomationRule, error) {
	rows, err := r.pool.Query(ctx, `
		SELECT id, board_id, name, trigger, actions, enabled, created_by, created_at, updated_at
		FROM automation_rules WHERE board_id = $1 AND enabled = TRUE`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AutomationRule
	for rows.Next() {
		var rule AutomationRule
		if err := rows.Scan(&rule.ID, &rule.BoardID, &rule.Name, &rule.Trigger, &rule.Actions,
			&rule.Enabled, &rule.CreatedBy, &rule.CreatedAt, &rule.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, rule)
	}
	return out, rows.Err()
}

func (r *AutomationRepo) Update(ctx context.Context, id, name string, trigger, actions json.RawMessage, enabled bool) error {
	ct, err := r.pool.Exec(ctx, `
		UPDATE automation_rules
		SET name = $2, trigger = $3, actions = $4, enabled = $5
		WHERE id = $1`,
		id, name, trigger, actions, enabled)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("rule not found")
	}
	return nil
}

func (r *AutomationRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM automation_rules WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("rule not found")
	}
	return nil
}

func (r *AutomationRepo) LogRun(ctx context.Context, ruleID, status, logMsg string) {
	_, _ = r.pool.Exec(ctx,
		`INSERT INTO automation_runs (rule_id, status, log) VALUES ($1, $2, $3)`,
		ruleID, status, logMsg)
}

func (r *AutomationRepo) ListRuns(ctx context.Context, ruleID string, limit int) ([]AutomationRun, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	rows, err := r.pool.Query(ctx,
		`SELECT id, rule_id, status, log, ran_at FROM automation_runs WHERE rule_id = $1
		 ORDER BY ran_at DESC LIMIT $2`, ruleID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []AutomationRun
	for rows.Next() {
		var run AutomationRun
		if err := rows.Scan(&run.ID, &run.RuleID, &run.Status, &run.Log, &run.RanAt); err != nil {
			return nil, err
		}
		out = append(out, run)
	}
	return out, rows.Err()
}

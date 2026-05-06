package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditEntry mirrors one row in audit_log. Optional fields use pgtype so
// they can stay nullable in JSON.
type AuditEntry struct {
	ID          pgtype.UUID `json:"id"`
	ActorUserID pgtype.UUID `json:"actor_user_id"`
	ActorEmail  string      `json:"actor_email"`
	ActorName   string      `json:"actor_name"`
	Action      string      `json:"action"`
	TargetType  string      `json:"target_type"`
	TargetID    string      `json:"target_id"`
	IP          string      `json:"ip"`
	UserAgent   string      `json:"user_agent"`
	Metadata    []byte      `json:"metadata,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
}

type AuditRepo struct {
	pool *pgxpool.Pool
}

func NewAuditRepo(pool *pgxpool.Pool) *AuditRepo {
	return &AuditRepo{pool: pool}
}

type AuditInsert struct {
	ActorUserID string // empty string allowed (anonymous events)
	Action      string
	TargetType  string
	TargetID    string
	IP          string
	UserAgent   string
	Metadata    interface{}
}

func (r *AuditRepo) Insert(ctx context.Context, in AuditInsert) error {
	if in.Action == "" {
		return fmt.Errorf("audit: action is required")
	}
	var meta []byte
	if in.Metadata != nil {
		b, err := json.Marshal(in.Metadata)
		if err != nil {
			return err
		}
		meta = b
	}
	const q = `
		INSERT INTO audit_log (actor_user_id, action, target_type, target_id, ip, user_agent, metadata)
		VALUES (NULLIF($1, '')::uuid, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), $7)`
	_, err := r.pool.Exec(ctx, q,
		in.ActorUserID, in.Action, in.TargetType, in.TargetID, in.IP, in.UserAgent, meta,
	)
	return err
}

type AuditFilter struct {
	ActorID string
	Action  string
	From    *time.Time
	To      *time.Time
	Limit   int
	Offset  int
}

func (r *AuditRepo) List(ctx context.Context, f AuditFilter) ([]AuditEntry, error) {
	limit := f.Limit
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	var (
		conds []string
		args  []interface{}
	)
	addArg := func(v interface{}) string {
		args = append(args, v)
		return fmt.Sprintf("$%d", len(args))
	}
	if f.ActorID != "" {
		conds = append(conds, "a.actor_user_id = "+addArg(f.ActorID)+"::uuid")
	}
	if f.Action != "" {
		conds = append(conds, "a.action = "+addArg(f.Action))
	}
	if f.From != nil {
		conds = append(conds, "a.created_at >= "+addArg(*f.From))
	}
	if f.To != nil {
		conds = append(conds, "a.created_at <= "+addArg(*f.To))
	}
	where := ""
	if len(conds) > 0 {
		where = "WHERE " + strings.Join(conds, " AND ")
	}

	q := fmt.Sprintf(`
		SELECT a.id, a.actor_user_id,
		       COALESCE(u.email, ''),
		       COALESCE(u.display_name, ''),
		       a.action,
		       COALESCE(a.target_type, ''),
		       COALESCE(a.target_id, ''),
		       COALESCE(a.ip, ''),
		       COALESCE(a.user_agent, ''),
		       a.metadata, a.created_at
		FROM audit_log a
		LEFT JOIN users u ON u.id = a.actor_user_id
		%s
		ORDER BY a.created_at DESC
		LIMIT %s OFFSET %s`, where, addArg(limit), addArg(f.Offset))

	rows, err := r.pool.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(
			&e.ID, &e.ActorUserID, &e.ActorEmail, &e.ActorName,
			&e.Action, &e.TargetType, &e.TargetID, &e.IP, &e.UserAgent,
			&e.Metadata, &e.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// DistinctActions returns the set of action strings already seen — handy for
// powering a filter dropdown without a pre-baked enum.
func (r *AuditRepo) DistinctActions(ctx context.Context) ([]string, error) {
	rows, err := r.pool.Query(ctx, `SELECT DISTINCT action FROM audit_log ORDER BY action`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var a string
		if err := rows.Scan(&a); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

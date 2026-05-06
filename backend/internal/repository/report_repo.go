package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ReportRepo runs the aggregation queries that power the per-board
// reports view. Pure SELECT, no caching layer (yet) — boards are small
// enough that direct queries return in single-digit ms.
type ReportRepo struct {
	pool *pgxpool.Pool
}

func NewReportRepo(pool *pgxpool.Pool) *ReportRepo {
	return &ReportRepo{pool: pool}
}

type CountByName struct {
	ID    string `json:"id,omitempty"`
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type TrendPoint struct {
	Date      string `json:"date"` // YYYY-MM-DD (UTC)
	Completed int    `json:"completed"`
	Created   int    `json:"created"`
}

type BoardReports struct {
	CardsByList     []CountByName `json:"cards_by_list"`
	CardsByPriority []CountByName `json:"cards_by_priority"`
	CardsByMember   []CountByName `json:"cards_by_member"`
	CompletionTrend []TrendPoint  `json:"completion_trend"`
	OpenCount       int           `json:"open_count"`
	CompletedCount  int           `json:"completed_count"`
	OverdueCount    int           `json:"overdue_count"`
}

func (r *ReportRepo) BoardReports(ctx context.Context, boardID string, days int) (*BoardReports, error) {
	if days <= 0 || days > 365 {
		days = 30
	}
	out := &BoardReports{
		CardsByList:     []CountByName{},
		CardsByPriority: []CountByName{},
		CardsByMember:   []CountByName{},
		CompletionTrend: []TrendPoint{},
	}

	listRows, err := r.pool.Query(ctx, `
		SELECT l.id::text, l.name, COUNT(c.id)
		FROM lists l
		LEFT JOIN cards c
		    ON c.list_id = l.id
		   AND c.deleted_at IS NULL
		   AND c.is_archived = FALSE
		WHERE l.board_id = $1 AND l.is_archived = FALSE
		GROUP BY l.id, l.name, l.position
		ORDER BY l.position`, boardID)
	if err != nil {
		return nil, err
	}
	for listRows.Next() {
		var c CountByName
		if err := listRows.Scan(&c.ID, &c.Name, &c.Count); err != nil {
			listRows.Close()
			return nil, err
		}
		out.CardsByList = append(out.CardsByList, c)
	}
	listRows.Close()

	priorityRows, err := r.pool.Query(ctx, `
		SELECT COALESCE(c.priority::text, 'none') AS priority, COUNT(*)
		FROM cards c
		JOIN lists l ON l.id = c.list_id
		WHERE l.board_id = $1
		  AND c.deleted_at IS NULL
		  AND c.is_archived = FALSE
		GROUP BY priority
		ORDER BY CASE priority
		    WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3
		    WHEN 'low' THEN 4 ELSE 5 END`, boardID)
	if err != nil {
		return nil, err
	}
	for priorityRows.Next() {
		var c CountByName
		if err := priorityRows.Scan(&c.Name, &c.Count); err != nil {
			priorityRows.Close()
			return nil, err
		}
		out.CardsByPriority = append(out.CardsByPriority, c)
	}
	priorityRows.Close()

	memberRows, err := r.pool.Query(ctx, `
		SELECT u.id::text, u.display_name, COUNT(*) AS card_count
		FROM card_assignees ca
		JOIN cards c ON c.id = ca.card_id
		JOIN lists l ON l.id = c.list_id
		JOIN users u ON u.id = ca.user_id
		WHERE l.board_id = $1
		  AND c.deleted_at IS NULL
		  AND c.is_archived = FALSE
		GROUP BY u.id, u.display_name
		ORDER BY card_count DESC, u.display_name
		LIMIT 25`, boardID)
	if err != nil {
		return nil, err
	}
	for memberRows.Next() {
		var c CountByName
		if err := memberRows.Scan(&c.ID, &c.Name, &c.Count); err != nil {
			memberRows.Close()
			return nil, err
		}
		out.CardsByMember = append(out.CardsByMember, c)
	}
	memberRows.Close()

	// Trend: per-day completed and created counts over the last `days`.
	since := time.Now().UTC().AddDate(0, 0, -days+1)
	trendRows, err := r.pool.Query(ctx, `
		WITH days AS (
		    SELECT generate_series(
		        date_trunc('day', $2::timestamptz),
		        date_trunc('day', NOW()),
		        '1 day'
		    )::date AS day
		),
		completed AS (
		    SELECT date_trunc('day', c.completed_at)::date AS day, COUNT(*) AS n
		    FROM cards c
		    JOIN lists l ON l.id = c.list_id
		    WHERE l.board_id = $1
		      AND c.completed_at IS NOT NULL
		      AND c.completed_at >= $2
		    GROUP BY 1
		),
		created AS (
		    SELECT date_trunc('day', c.created_at)::date AS day, COUNT(*) AS n
		    FROM cards c
		    JOIN lists l ON l.id = c.list_id
		    WHERE l.board_id = $1
		      AND c.created_at >= $2
		    GROUP BY 1
		)
		SELECT to_char(d.day, 'YYYY-MM-DD'),
		       COALESCE(c.n, 0),
		       COALESCE(cr.n, 0)
		FROM days d
		LEFT JOIN completed c  ON c.day  = d.day
		LEFT JOIN created   cr ON cr.day = d.day
		ORDER BY d.day`, boardID, since)
	if err != nil {
		return nil, err
	}
	for trendRows.Next() {
		var p TrendPoint
		if err := trendRows.Scan(&p.Date, &p.Completed, &p.Created); err != nil {
			trendRows.Close()
			return nil, err
		}
		out.CompletionTrend = append(out.CompletionTrend, p)
	}
	trendRows.Close()

	if err := r.pool.QueryRow(ctx, `
		SELECT
		    COUNT(*) FILTER (WHERE c.completed_at IS NULL),
		    COUNT(*) FILTER (WHERE c.completed_at IS NOT NULL),
		    COUNT(*) FILTER (
		        WHERE c.completed_at IS NULL
		          AND c.due_date IS NOT NULL
		          AND c.due_date < NOW()
		    )
		FROM cards c
		JOIN lists l ON l.id = c.list_id
		WHERE l.board_id = $1
		  AND c.deleted_at IS NULL
		  AND c.is_archived = FALSE`, boardID).
		Scan(&out.OpenCount, &out.CompletedCount, &out.OverdueCount); err != nil {
		return nil, err
	}

	return out, nil
}

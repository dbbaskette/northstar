package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type TeamRepo struct {
	pool *pgxpool.Pool
}

func NewTeamRepo(pool *pgxpool.Pool) *TeamRepo {
	return &TeamRepo{pool: pool}
}

func (r *TeamRepo) Create(ctx context.Context, t *models.Team) error {
	const q = `
		INSERT INTO teams (name, description, created_by)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q, t.Name, t.Description, t.CreatedBy).
		Scan(&t.ID, &t.CreatedAt, &t.UpdatedAt)
}

func (r *TeamRepo) FindByID(ctx context.Context, id string) (*models.Team, error) {
	const q = `
		SELECT id, name, description, created_by, created_at, updated_at
		FROM teams WHERE id = $1`

	t := &models.Team{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&t.ID, &t.Name, &t.Description, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("team not found")
	}
	return t, err
}

func (r *TeamRepo) ListByUser(ctx context.Context, userID string) ([]models.Team, error) {
	const q = `
		SELECT t.id, t.name, t.description, t.created_by, t.created_at, t.updated_at
		FROM teams t
		JOIN team_members tm ON t.id = tm.team_id
		WHERE tm.user_id = $1
		ORDER BY t.name`

	rows, err := r.pool.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var teams []models.Team
	for rows.Next() {
		var t models.Team
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &t.CreatedBy, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		teams = append(teams, t)
	}
	return teams, rows.Err()
}

func (r *TeamRepo) Update(ctx context.Context, id, name, description string) error {
	const q = `UPDATE teams SET name = $2, description = $3 WHERE id = $1`
	ct, err := r.pool.Exec(ctx, q, id, name, description)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("team not found")
	}
	return nil
}

func (r *TeamRepo) Delete(ctx context.Context, id string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM teams WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("team not found")
	}
	return nil
}

func (r *TeamRepo) AddMember(ctx context.Context, teamID, userID, role string) error {
	const q = `
		INSERT INTO team_members (team_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (team_id, user_id) DO UPDATE SET role = $3`
	_, err := r.pool.Exec(ctx, q, teamID, userID, role)
	return err
}

func (r *TeamRepo) RemoveMember(ctx context.Context, teamID, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`DELETE FROM team_members WHERE team_id = $1 AND user_id = $2`,
		teamID, userID,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("member not found")
	}
	return nil
}

func (r *TeamRepo) GetMembers(ctx context.Context, teamID string) ([]models.TeamMember, error) {
	const q = `
		SELECT tm.team_id, tm.user_id, tm.role, tm.joined_at,
		       u.id, u.email, u.username, u.display_name, u.avatar_url, u.role
		FROM team_members tm
		JOIN users u ON tm.user_id = u.id
		WHERE tm.team_id = $1
		ORDER BY u.display_name`

	rows, err := r.pool.Query(ctx, q, teamID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []models.TeamMember
	for rows.Next() {
		var m models.TeamMember
		u := &models.User{}
		if err := rows.Scan(
			&m.TeamID, &m.UserID, &m.Role, &m.JoinedAt,
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.AvatarURL, &u.Role,
		); err != nil {
			return nil, err
		}
		m.User = u
		members = append(members, m)
	}
	return members, rows.Err()
}

func (r *TeamRepo) GetMemberRole(ctx context.Context, teamID, userID string) (string, error) {
	var role string
	err := r.pool.QueryRow(ctx,
		`SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2`,
		teamID, userID,
	).Scan(&role)
	if err == pgx.ErrNoRows {
		return "", fmt.Errorf("not a member")
	}
	return role, err
}

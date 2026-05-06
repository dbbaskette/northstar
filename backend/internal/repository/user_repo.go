package repository

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dbbaskette/northstar/internal/models"
)

type UserRepo struct {
	pool *pgxpool.Pool
}

func NewUserRepo(pool *pgxpool.Pool) *UserRepo {
	return &UserRepo{pool: pool}
}

func (r *UserRepo) Create(ctx context.Context, u *models.User) error {
	const q = `
		INSERT INTO users (email, username, password_hash, display_name, role)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`

	return r.pool.QueryRow(ctx, q,
		u.Email, u.Username, u.PasswordHash, u.DisplayName, u.Role,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *UserRepo) FindByEmail(ctx context.Context, email string) (*models.User, error) {
	const q = `
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, created_at, updated_at
		FROM users WHERE email = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

// FindByExternalID returns the user already linked to the given SSO
// (provider, external user ID) tuple, or pgx.ErrNoRows.
func (r *UserRepo) FindByExternalID(ctx context.Context, provider, externalID string) (*models.User, error) {
	const q = `
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, created_at, updated_at
		FROM users WHERE external_provider = $1 AND external_id = $2`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, provider, externalID).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

// LinkExternalID attaches an SSO identity to an existing user (by ID).
// Used when an SSO login matches an existing email but the user signed
// up with a password.
func (r *UserRepo) LinkExternalID(ctx context.Context, userID, provider, externalID string) error {
	_, err := r.pool.Exec(ctx,
		`UPDATE users SET external_provider = $2, external_id = $3 WHERE id = $1`,
		userID, provider, externalID,
	)
	return err
}

// CreateExternalUser creates a user that authenticates only via SSO —
// password_hash stays empty string.
func (r *UserRepo) CreateExternalUser(ctx context.Context, u *models.User, provider, externalID string) error {
	const q = `
		INSERT INTO users (email, username, password_hash, display_name, role, external_provider, external_id)
		VALUES ($1, $2, '', $3, $4, $5, $6)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, q,
		u.Email, u.Username, u.DisplayName, u.Role, provider, externalID,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

func (r *UserRepo) FindByID(ctx context.Context, id string) (*models.User, error) {
	const q = `
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, created_at, updated_at
		FROM users WHERE id = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

func (r *UserRepo) List(ctx context.Context) ([]models.User, error) {
	const q = `
		SELECT id, email, username, display_name, avatar_url, bio, timezone, role, created_at, updated_at
		FROM users ORDER BY display_name`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Username, &u.DisplayName,
			&u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

type ProfileUpdate struct {
	DisplayName string
	Bio         string
	Timezone    string
	AvatarURL   *string
}

func (r *UserRepo) UpdateProfile(ctx context.Context, id string, p ProfileUpdate) error {
	q := `
		UPDATE users
		SET display_name = $2,
		    bio = $3,
		    timezone = $4`
	args := []interface{}{id, p.DisplayName, p.Bio, p.Timezone}
	if p.AvatarURL != nil {
		q += `, avatar_url = $5`
		args = append(args, *p.AvatarURL)
	}
	q += ` WHERE id = $1`

	ct, err := r.pool.Exec(ctx, q, args...)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

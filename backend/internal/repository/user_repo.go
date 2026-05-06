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
		SELECT id, email, username, password_hash, display_name, avatar_url, role, created_at, updated_at
		FROM users WHERE email = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

func (r *UserRepo) FindByID(ctx context.Context, id string) (*models.User, error) {
	const q = `
		SELECT id, email, username, password_hash, display_name, avatar_url, role, created_at, updated_at
		FROM users WHERE id = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Role, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

func (r *UserRepo) List(ctx context.Context) ([]models.User, error) {
	const q = `
		SELECT id, email, username, display_name, avatar_url, role, created_at, updated_at
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
			&u.AvatarURL, &u.Role, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, err
		}
		users = append(users, u)
	}
	return users, rows.Err()
}

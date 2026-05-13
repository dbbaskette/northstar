package repository

import (
	"context"
	"fmt"
	"time"

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
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, must_change_password, created_at, updated_at
		FROM users WHERE email = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, email).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
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
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, must_change_password, created_at, updated_at
		FROM users WHERE external_provider = $1 AND external_id = $2`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, provider, externalID).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
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
		SELECT id, email, username, password_hash, display_name, avatar_url, bio, timezone, role, must_change_password, created_at, updated_at
		FROM users WHERE id = $1`

	u := &models.User{}
	err := r.pool.QueryRow(ctx, q, id).Scan(
		&u.ID, &u.Email, &u.Username, &u.PasswordHash,
		&u.DisplayName, &u.AvatarURL, &u.Bio, &u.Timezone, &u.Role, &u.MustChangePassword, &u.CreatedAt, &u.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("user not found")
	}
	return u, err
}

func (r *UserRepo) List(ctx context.Context) ([]models.User, error) {
	const q = `
		SELECT id, email, username, display_name, avatar_url, bio, timezone, role, created_at, updated_at
		FROM users WHERE is_active = TRUE ORDER BY display_name`

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

// AdminUser is a fuller listing record exposed only via /admin/users —
// it includes deactivation state, approval state, and the SSO-link
// provider.
type AdminUser struct {
	ID               string     `json:"id"`
	Email            string     `json:"email"`
	Username         string     `json:"username"`
	DisplayName      string     `json:"display_name"`
	Role             string     `json:"role"`
	IsActive         bool       `json:"is_active"`
	DeactivatedAt    *time.Time `json:"deactivated_at,omitempty"`
	ApprovedAt       *time.Time `json:"approved_at,omitempty"`
	ExternalProvider *string    `json:"external_provider,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	LastLoginAt      *time.Time `json:"last_login_at,omitempty"`
}

func (r *UserRepo) AdminList(ctx context.Context) ([]AdminUser, error) {
	// Pending users sort to the very top so they don't get missed.
	const q = `
		SELECT u.id::text, u.email, u.username, u.display_name, u.role, u.is_active,
		       u.deactivated_at, u.approved_at, u.external_provider, u.created_at,
		       (SELECT MAX(created_at) FROM audit_log a
		          WHERE a.actor_user_id = u.id AND a.action IN ('auth.login','auth.sso_login'))
		FROM users u
		ORDER BY (u.approved_at IS NULL) DESC, u.is_active DESC, u.display_name`

	rows, err := r.pool.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []AdminUser{}
	for rows.Next() {
		var u AdminUser
		var deact, approved, last *time.Time
		var prov *string
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Username, &u.DisplayName, &u.Role, &u.IsActive,
			&deact, &approved, &prov, &u.CreatedAt, &last,
		); err != nil {
			return nil, err
		}
		u.DeactivatedAt = deact
		u.ApprovedAt = approved
		u.LastLoginAt = last
		u.ExternalProvider = prov
		out = append(out, u)
	}
	return out, rows.Err()
}

// CreateAdminInvited creates a user with a temporary password and
// the must_change_password flag set. Skips the public approval
// queue — admin-created accounts are pre-approved.
func (r *UserRepo) CreateAdminInvited(ctx context.Context, u *models.User) error {
	const q = `
		INSERT INTO users (email, username, password_hash, display_name, role,
		                   approved_at, must_change_password)
		VALUES ($1, $2, $3, $4, $5, NOW(), TRUE)
		RETURNING id, created_at, updated_at`
	return r.pool.QueryRow(ctx, q,
		u.Email, u.Username, u.PasswordHash, u.DisplayName, u.Role,
	).Scan(&u.ID, &u.CreatedAt, &u.UpdatedAt)
}

// SetPassword replaces the password hash AND clears the
// must_change_password flag. Used by /me/password.
func (r *UserRepo) SetPassword(ctx context.Context, userID, hash string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE users SET password_hash = $2, must_change_password = FALSE WHERE id = $1`,
		userID, hash,
	)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// MustChangePassword reports the flag for the given user.
func (r *UserRepo) MustChangePassword(ctx context.Context, userID string) (bool, error) {
	var v bool
	err := r.pool.QueryRow(ctx,
		`SELECT must_change_password FROM users WHERE id = $1`, userID,
	).Scan(&v)
	if err == pgx.ErrNoRows {
		return false, fmt.Errorf("user not found")
	}
	return v, err
}

// CountUsers returns how many users exist — used by Register to
// detect the very first signup and bootstrap the admin role.
func (r *UserRepo) CountUsers(ctx context.Context) (int, error) {
	var n int
	err := r.pool.QueryRow(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n, err
}

// Approve flips approved_at from NULL to NOW(). No-op (returns nil) on
// already-approved users so admins can click the button repeatedly
// without needing extra state checks.
func (r *UserRepo) Approve(ctx context.Context, userID string) error {
	ct, err := r.pool.Exec(ctx,
		`UPDATE users SET approved_at = NOW() WHERE id = $1 AND approved_at IS NULL`,
		userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		// Either the user doesn't exist or they're already approved.
		// Treat already-approved as success so the UI doesn't 404 on a
		// double-click; the repo caller can verify existence via FindByID
		// when it matters.
	}
	return nil
}

// IsApproved returns true when approved_at is set.
func (r *UserRepo) IsApproved(ctx context.Context, userID string) (bool, error) {
	var approved *time.Time
	err := r.pool.QueryRow(ctx,
		`SELECT approved_at FROM users WHERE id = $1`, userID).Scan(&approved)
	if err == pgx.ErrNoRows {
		return false, fmt.Errorf("user not found")
	}
	if err != nil {
		return false, err
	}
	return approved != nil, nil
}

// HardDelete removes the user row entirely. Cascades through every
// table that references users.id ON DELETE CASCADE/SET NULL — boards
// and cards they created stick around (created_by becomes NULL),
// activity rows stay attributed to (deleted) ids.
func (r *UserRepo) HardDelete(ctx context.Context, userID string) error {
	ct, err := r.pool.Exec(ctx, `DELETE FROM users WHERE id = $1`, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

func (r *UserRepo) SetRole(ctx context.Context, userID, role string) error {
	switch role {
	case "admin", "member", "viewer":
	default:
		return fmt.Errorf("invalid role %q", role)
	}
	ct, err := r.pool.Exec(ctx,
		`UPDATE users SET role = $2 WHERE id = $1`, userID, role)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// SetActive flips the activation bit. When deactivating, also stamps
// deactivated_at so audit reports can reconstruct timing.
func (r *UserRepo) SetActive(ctx context.Context, userID string, active bool) error {
	var q string
	if active {
		q = `UPDATE users SET is_active = TRUE, deactivated_at = NULL WHERE id = $1`
	} else {
		q = `UPDATE users SET is_active = FALSE, deactivated_at = NOW() WHERE id = $1`
	}
	ct, err := r.pool.Exec(ctx, q, userID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return fmt.Errorf("user not found")
	}
	return nil
}

// RevokeRefreshTokens wipes a user's refresh tokens — used when an admin
// forces them off all devices, or as part of deactivation.
func (r *UserRepo) RevokeRefreshTokens(ctx context.Context, userID string) error {
	_, err := r.pool.Exec(ctx, `DELETE FROM refresh_tokens WHERE user_id = $1`, userID)
	return err
}

func (r *UserRepo) IsActive(ctx context.Context, userID string) (bool, error) {
	var active bool
	err := r.pool.QueryRow(ctx, `SELECT is_active FROM users WHERE id = $1`, userID).Scan(&active)
	if err == pgx.ErrNoRows {
		return false, fmt.Errorf("user not found")
	}
	return active, err
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

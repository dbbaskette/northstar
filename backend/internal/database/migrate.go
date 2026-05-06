package database

import (
	"embed"
	"errors"
	"fmt"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func RunMigrations(pool *pgxpool.Pool) error {
	db := stdlib.OpenDBFromPool(pool)
	defer db.Close()

	driver, err := postgres.WithInstance(db, &postgres.Config{})
	if err != nil {
		return fmt.Errorf("creating migration driver: %w", err)
	}

	sourceDriver, err := iofs.New(migrationFS, "migrations")
	if err != nil {
		return fmt.Errorf("creating migration source: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", driver)
	if err != nil {
		return fmt.Errorf("creating migrator: %w", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("running migrations: %w", err)
	}

	return nil
}

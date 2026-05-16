package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DBInfo captures whether the bound Postgres instance has TDE-class
// at-rest encryption set up, as seen through the running app's own
// connection (no extra credentials, no extra access surface).
//
// Tanzu Postgres Advanced ships `pg_tde`: an extension that adds an
// encrypted heap access method (`tde_heap`). If the extension isn't
// installed and no table uses an encrypted AM, TDE is effectively
// off for application data.
type DBInfo struct {
	Version           string         `json:"postgres_version"`
	TDEAvailable      bool           `json:"tde_available"`
	TDEInstalled      bool           `json:"tde_installed"`
	EncryptedAMs      []string       `json:"encrypted_access_methods"`
	TablesEncrypted   int            `json:"tables_encrypted"`
	TablesUnencrypted int            `json:"tables_unencrypted"`
	TableSample       []TableEncrypt `json:"table_sample"`
	Extensions        []ExtInfo      `json:"installed_extensions"`
}

type TableEncrypt struct {
	Schema    string `json:"schema"`
	Table     string `json:"table"`
	AM        string `json:"access_method"`
	Encrypted bool   `json:"encrypted"`
}

type ExtInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type DBInfoRepo struct {
	pool *pgxpool.Pool
}

func NewDBInfoRepo(pool *pgxpool.Pool) *DBInfoRepo {
	return &DBInfoRepo{pool: pool}
}

func (r *DBInfoRepo) Get(ctx context.Context) (*DBInfo, error) {
	out := &DBInfo{
		EncryptedAMs: []string{},
		TableSample:  []TableEncrypt{},
		Extensions:   []ExtInfo{},
	}

	// Postgres version banner — handy on its own.
	_ = r.pool.QueryRow(ctx, `SELECT version()`).Scan(&out.Version)

	// Is pg_tde available / installed?
	_ = r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'pg_tde')`,
	).Scan(&out.TDEAvailable)
	_ = r.pool.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_tde')`,
	).Scan(&out.TDEInstalled)

	// All installed extensions — handy context for support.
	if rows, err := r.pool.Query(ctx,
		`SELECT extname, extversion FROM pg_extension ORDER BY extname`,
	); err == nil {
		defer rows.Close()
		for rows.Next() {
			var e ExtInfo
			if rows.Scan(&e.Name, &e.Version) == nil {
				out.Extensions = append(out.Extensions, e)
			}
		}
	}

	// Encrypted table access methods Postgres knows about.
	if rows, err := r.pool.Query(ctx,
		`SELECT amname FROM pg_am WHERE amtype = 't' AND amname ILIKE '%tde%' ORDER BY amname`,
	); err == nil {
		defer rows.Close()
		for rows.Next() {
			var n string
			if rows.Scan(&n) == nil {
				out.EncryptedAMs = append(out.EncryptedAMs, n)
			}
		}
	}

	// Per-table access method — encrypted vs not. Just public schema
	// since that's where the app's tables live.
	if rows, err := r.pool.Query(ctx, `
		SELECT n.nspname, c.relname, a.amname
		  FROM pg_class c
		  JOIN pg_am a ON a.oid = c.relam
		  JOIN pg_namespace n ON n.oid = c.relnamespace
		 WHERE c.relkind = 'r' AND n.nspname = 'public'
		 ORDER BY c.relname`,
	); err == nil {
		defer rows.Close()
		for rows.Next() {
			var t TableEncrypt
			if rows.Scan(&t.Schema, &t.Table, &t.AM) == nil {
				t.Encrypted = isEncryptedAM(t.AM)
				out.TableSample = append(out.TableSample, t)
				if t.Encrypted {
					out.TablesEncrypted++
				} else {
					out.TablesUnencrypted++
				}
			}
		}
	}

	return out, nil
}

func isEncryptedAM(am string) bool {
	switch am {
	case "tde_heap", "tde_heap_basic":
		return true
	}
	return false
}

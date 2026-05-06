package service

import (
	"context"
	"regexp"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Mention parser: matches @username where username is alphanumeric/underscore.
// Avoids matching email addresses by requiring the @ to NOT be preceded by a
// non-whitespace character.
var mentionRE = regexp.MustCompile(`(?:^|[^\w@])@([a-zA-Z0-9_]+)`)

type Mentions struct {
	pool *pgxpool.Pool
}

func NewMentions(pool *pgxpool.Pool) *Mentions {
	return &Mentions{pool: pool}
}

// Extract returns the unique usernames mentioned in body (without the @).
func (m *Mentions) Extract(body string) []string {
	matches := mentionRE.FindAllStringSubmatch(body, -1)
	seen := make(map[string]struct{})
	out := make([]string, 0, len(matches))
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		uname := strings.ToLower(match[1])
		if _, ok := seen[uname]; ok {
			continue
		}
		seen[uname] = struct{}{}
		out = append(out, uname)
	}
	return out
}

// Resolve takes a list of usernames and returns the corresponding user IDs.
// Unknown usernames are dropped silently.
func (m *Mentions) Resolve(ctx context.Context, usernames []string) ([]string, error) {
	if len(usernames) == 0 {
		return nil, nil
	}
	rows, err := m.pool.Query(ctx,
		`SELECT id::text FROM users WHERE LOWER(username) = ANY($1)`,
		usernames)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

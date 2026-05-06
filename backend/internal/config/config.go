package config

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Port        int
	DatabaseURL string
	JWTSecret   string
	LogLevel    string
	StoragePath string
	BaseURL     string

	GitHubClientID     string
	GitHubClientSecret string

	// BootstrapAdminEmail, when set, promotes the matching user to
	// role='admin' + approved on every backend startup. Idempotent —
	// once they're admin it's a no-op. Useful for the very first push
	// to CF when you registered before the migration shipped.
	BootstrapAdminEmail string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        8180,
		LogLevel:    "info",
		StoragePath: "./storage",
	}

	if sp := os.Getenv("STORAGE_PATH"); sp != "" {
		cfg.StoragePath = sp
	}

	if p := os.Getenv("PORT"); p != "" {
		port, err := strconv.Atoi(p)
		if err != nil {
			return nil, fmt.Errorf("invalid PORT: %w", err)
		}
		cfg.Port = port
	}

	cfg.JWTSecret = os.Getenv("JWT_SECRET")
	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "dev-secret-change-in-production"
	}

	if lvl := os.Getenv("LOG_LEVEL"); lvl != "" {
		cfg.LogLevel = lvl
	}

	cfg.DatabaseURL = os.Getenv("DATABASE_URL")
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = parseCFPostgres()
	}
	if cfg.DatabaseURL == "" {
		cfg.DatabaseURL = "postgres://northstar:northstar@localhost:5432/northstar?sslmode=disable"
	}

	cfg.BaseURL = os.Getenv("BASE_URL") // e.g. https://northstar.example.com
	cfg.GitHubClientID = os.Getenv("GITHUB_CLIENT_ID")
	cfg.GitHubClientSecret = os.Getenv("GITHUB_CLIENT_SECRET")
	cfg.BootstrapAdminEmail = os.Getenv("BOOTSTRAP_ADMIN_EMAIL")

	return cfg, nil
}

func parseCFPostgres() string {
	vcap := os.Getenv("VCAP_SERVICES")
	if vcap == "" {
		return ""
	}

	var services map[string][]struct {
		Credentials struct {
			URI string `json:"uri"`
		} `json:"credentials"`
	}

	if err := json.Unmarshal([]byte(vcap), &services); err != nil {
		return ""
	}

	for _, key := range []string{"postgresql", "postgres", "elephantsql", "user-provided"} {
		if svcList, ok := services[key]; ok && len(svcList) > 0 {
			if uri := svcList[0].Credentials.URI; uri != "" {
				return uri
			}
		}
	}
	return ""
}

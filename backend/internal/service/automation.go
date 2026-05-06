package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/dbbaskette/northstar/internal/repository"
)

// AutomationEngine runs trigger-action rules in response to board events.
//
// Trigger JSON shape:
//
//	{"event": "card.moved", "to_list_id": "..."}
//	{"event": "card.created"}                       (any list)
//	{"event": "card.created", "in_list_id": "..."}
//	{"event": "label.attached", "label_id": "..."}
//
// Action JSON shape (an array of these):
//
//	{"type": "add_label",       "label_id": "..."}
//	{"type": "remove_label",    "label_id": "..."}
//	{"type": "move_to_list",    "list_id": "..."}
//	{"type": "mark_complete"}
//	{"type": "post_comment",    "body": "..."}
type AutomationEngine struct {
	pool       *pgxpool.Pool
	rules      *repository.AutomationRepo
	cardRepo   *repository.CardRepo
	labelRepo  *repository.LabelRepo
	systemUser string // user_id used as the actor for automation comments/etc.
}

func NewAutomationEngine(
	pool *pgxpool.Pool,
	rules *repository.AutomationRepo,
	cardRepo *repository.CardRepo,
	labelRepo *repository.LabelRepo,
) *AutomationEngine {
	return &AutomationEngine{pool: pool, rules: rules, cardRepo: cardRepo, labelRepo: labelRepo}
}

// Handle is called from Events.Emit after every event. It loads enabled
// rules for the board, evaluates each trigger against the event, and
// dispatches actions for matching rules. Errors are logged but never
// propagated — automation must not break the user-facing mutation.
func (a *AutomationEngine) Handle(ctx context.Context, boardID, event string, payload interface{}) {
	if a == nil {
		return
	}
	if !strings.HasPrefix(event, "card.") && !strings.HasPrefix(event, "label.") {
		return // we only care about a few classes of events
	}

	rules, err := a.rules.MatchingForBoard(ctx, boardID)
	if err != nil {
		log.Warn().Err(err).Str("board_id", boardID).Msg("automation: rule lookup failed")
		return
	}
	if len(rules) == 0 {
		return
	}

	payloadMap, _ := payload.(map[string]interface{})

	for _, rule := range rules {
		var trigger map[string]interface{}
		if err := json.Unmarshal(rule.Trigger, &trigger); err != nil {
			a.rules.LogRun(ctx, uuidStr(rule.ID), "error", "invalid trigger JSON: "+err.Error())
			continue
		}
		if !triggerMatches(trigger, event, payloadMap) {
			continue
		}

		var actions []map[string]interface{}
		if err := json.Unmarshal(rule.Actions, &actions); err != nil {
			a.rules.LogRun(ctx, uuidStr(rule.ID), "error", "invalid actions JSON: "+err.Error())
			continue
		}

		summary := a.runActions(ctx, payloadMap, actions)
		a.rules.LogRun(ctx, uuidStr(rule.ID), "success", summary)
	}
}

func triggerMatches(trigger map[string]interface{}, event string, payload map[string]interface{}) bool {
	if trigger["event"] != event {
		return false
	}
	for k, expected := range trigger {
		if k == "event" {
			continue
		}
		actual, ok := payload[k]
		if !ok || actual != expected {
			return false
		}
	}
	return true
}

func (a *AutomationEngine) runActions(ctx context.Context, payload map[string]interface{}, actions []map[string]interface{}) string {
	cardID, _ := payload["card_id"].(string)
	if cardID == "" {
		return "skipped: no card_id in payload"
	}

	var summary []string
	for _, action := range actions {
		actionType, _ := action["type"].(string)
		switch actionType {
		case "add_label":
			labelID, _ := action["label_id"].(string)
			if labelID == "" {
				summary = append(summary, "add_label: missing label_id")
				continue
			}
			if err := a.labelRepo.AttachToCard(ctx, cardID, labelID); err != nil {
				summary = append(summary, "add_label: "+err.Error())
			} else {
				summary = append(summary, "add_label "+labelID)
			}
		case "remove_label":
			labelID, _ := action["label_id"].(string)
			if labelID == "" {
				summary = append(summary, "remove_label: missing label_id")
				continue
			}
			if err := a.labelRepo.DetachFromCard(ctx, cardID, labelID); err != nil {
				summary = append(summary, "remove_label: "+err.Error())
			} else {
				summary = append(summary, "remove_label "+labelID)
			}
		case "move_to_list":
			listID, _ := action["list_id"].(string)
			if listID == "" {
				summary = append(summary, "move_to_list: missing list_id")
				continue
			}
			pos, _ := a.cardRepo.NextPositionInList(ctx, listID)
			if err := a.cardRepo.Move(ctx, cardID, listID, pos); err != nil {
				summary = append(summary, "move_to_list: "+err.Error())
			} else {
				summary = append(summary, "move_to_list "+listID)
			}
		case "mark_complete":
			if err := a.cardRepo.SetCompleted(ctx, cardID, true); err != nil {
				summary = append(summary, "mark_complete: "+err.Error())
			} else {
				summary = append(summary, "mark_complete")
			}
		case "post_comment":
			body, _ := action["body"].(string)
			if body == "" {
				summary = append(summary, "post_comment: missing body")
				continue
			}
			if _, err := a.pool.Exec(ctx,
				`INSERT INTO card_comments (card_id, user_id, body)
				 SELECT $1, c.created_by, $2 FROM cards c WHERE c.id = $1`,
				cardID, body); err != nil {
				summary = append(summary, "post_comment: "+err.Error())
			} else {
				summary = append(summary, "post_comment")
			}
		default:
			summary = append(summary, fmt.Sprintf("unknown action: %s", actionType))
		}
	}
	return strings.Join(summary, "; ")
}

package service

import (
	"context"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/dbbaskette/northstar/internal/repository"
)

// ReminderWorker scans for due reminders every tick and emits
// notifications via the existing Events fan-out.
type ReminderWorker struct {
	reminderRepo *repository.ReminderRepo
	events       *Events
	interval     time.Duration
}

func NewReminderWorker(reminderRepo *repository.ReminderRepo, events *Events, interval time.Duration) *ReminderWorker {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	return &ReminderWorker{
		reminderRepo: reminderRepo,
		events:       events,
		interval:     interval,
	}
}

func (w *ReminderWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.tick(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.tick(ctx)
		}
	}
}

func (w *ReminderWorker) tick(ctx context.Context) {
	pending, err := w.reminderRepo.PendingDue(ctx, time.Now(), 200)
	if err != nil {
		log.Warn().Err(err).Msg("reminder worker: scan failed")
		return
	}
	for _, p := range pending {
		recipients := []string{p.UserID}
		if p.UserID == "" {
			ids, err := w.reminderRepo.AssigneesForCard(ctx, p.CardID)
			if err != nil {
				log.Warn().Err(err).Str("card_id", p.CardID).Msg("assignees fetch failed")
				continue
			}
			recipients = ids
		}
		if len(recipients) > 0 {
			payload := map[string]interface{}{
				"card_id":      p.CardID,
				"card_title":   p.CardTitle,
				"due_date":     p.DueDate,
				"lead_minutes": p.LeadMinutes,
			}
			w.events.Notify(ctx, recipients, "", "due.reminder", p.CardID, p.BoardID, payload)
		}
		if err := w.reminderRepo.MarkSent(ctx, p.ID); err != nil {
			log.Warn().Err(err).Str("reminder_id", p.ID).Msg("mark sent failed")
		}
	}
}

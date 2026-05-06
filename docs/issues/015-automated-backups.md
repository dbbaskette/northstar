# Automated database backups and restore runbook

## Problem
This is a self-hosted deployment with team-critical data. Without automated backups, a single bad migration or disk failure loses everyone's work.

## Acceptance criteria
- [ ] Daily `pg_dump` job runs at off-peak hours and uploads to S3 / GCS / on-prem object storage
- [ ] Retention policy: 7 daily, 4 weekly, 6 monthly
- [ ] Documented restore procedure tested at least once before production
- [ ] Admin-triggered "Backup now" button before risky operations
- [ ] Backup metadata visible to admin (status, size, age)

## Implementation notes
- Ops: cron / k8s CronJob / CF run-task
- DB: optional `backups(id, started_at, finished_at, size_bytes, location, status)` for admin visibility
- Document in `docs/runbooks/backup.md`

<!-- labels: P0,ops,area:platform -->

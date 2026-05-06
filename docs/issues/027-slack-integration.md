# Slack integration

## Problem
Slack is where teams already are. Posting card events to a channel and creating cards from Slack is the most-requested integration.

## Acceptance criteria
- [ ] Connect Slack workspace via OAuth from board settings
- [ ] Choose a channel and event filters; messages post on selected events
- [ ] Slash command: `/northstar new "Card title" #board-name` creates a card
- [ ] Disconnect cleanly removes tokens

## Implementation notes
- DB: `slack_integrations(id, board_id, workspace_id, channel_id, event_filters_json, access_token_encrypted)`
- Backend: Slack OAuth handler; outgoing message formatter; inbound slash-command webhook
- Depends on: issue 026 (webhooks infra is similar)

<!-- labels: P1,feature,backend,frontend,area:integrations,needs:slack-app -->

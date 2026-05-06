# Plugin / Power-Up framework

## Problem
Customers will always want features specific to their workflow. A plugin framework lets them extend Northstar without forking.

## Acceptance criteria
- [ ] Manifest-based plugin definition (name, capabilities, iframe URL)
- [ ] Plugins can add: card buttons, board sections, custom field types, badges on cards
- [ ] Sandboxed iframe with signed message API to read/write data via scoped permissions
- [ ] Per-board enable / disable
- [ ] Plugin directory page

## Implementation notes
- Significant scope — start with a minimal capability surface (read board, add card button) and expand
- DB: `plugins(id, name, manifest_url, version)`, `board_plugins(board_id, plugin_id, config_json, enabled)`
- Frontend: postMessage protocol; CSP `frame-src` configured per-plugin

<!-- labels: P2,feature,backend,frontend,area:platform,size:large -->

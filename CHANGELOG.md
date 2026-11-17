---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.1.0"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.1.0]

### Added

- Use this plugin on a New API channel (type 60) whose upstream is another New API gateway with the same plugin installed: requests go to that gateway's `/{key}/v1/...` routes and `/{key}/runway/v1/tasks/{id}` with its token as a Bearer header, `{"task_id"}` references resolve on that gateway, downloads come from its task content route, and tasks settle on the credits Runway charged, which the task route now returns as `cost.credits`.

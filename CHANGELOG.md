---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.0.0"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.0.0]

### Added

- Runway API task plugin for Runway's own models: Gen-4.5 text to video and image to video, Gen-4 Turbo image to video, Aleph 2.0 video editing, Act-Two character performance, and Gen-4 Image and Gen-4 Image Turbo images, on Runway's native paths, the OpenAI video API and the OpenAI Images API.
- Tasks are polled at Runway's `GET /v1/tasks/{id}` with the required `X-Runway-Version` header, and clients query native tasks at `/runway/v1/tasks/{id}`, with output URLs replaced by gateway download addresses that refresh Runway's expiring links.
- Billing in Runway credits: each task reserves Runway's list price for its model, duration and output format, and settles on the `cost.credits` Runway reports when it succeeds.
- Earlier gateway tasks can be passed as `{"task_id": ...}` wherever a media URL goes, for example to edit a Gen-4.5 video with Aleph 2.0.

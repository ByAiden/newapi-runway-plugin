---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.1.1"
locale: "en"
translations:
  zh-CN: CHANGELOG.zh-CN.md
---
# Changelog

## [1.1.1]

### Changed

- README explains how to add a margin: multiply each unit price inside the expression. Appending `* 1.2` to the whole expression still bills correctly, but the gateway's model page then shows the raw expression instead of a price table.

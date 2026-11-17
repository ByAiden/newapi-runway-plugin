---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.1.0"
locale: "zh-CN"
---
# Changelog

## [1.1.0]

### Added

- 可在上游为另一台已安装本插件的 New API 网关的 New API 渠道（类型 60）上使用本插件：请求发往该网关的 `/{key}/v1/...` 路由和 `/{key}/runway/v1/tasks/{id}` 并以其令牌作 Bearer 认证，`{"task_id"}` 引用由该网关解析，下载走它的任务内容路由，任务按 Runway 实际扣除的积分结算；任务查询路由现在会返回该积分 `cost.credits`。

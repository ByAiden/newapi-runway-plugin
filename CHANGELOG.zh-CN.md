---
changelogVersion: 1
plugin: "byaiden_runway"
version: "1.0.0"
locale: "zh-CN"
---
# Changelog

## [1.0.0]

### Added

- Runway API 任务插件，覆盖 Runway 自研模型：Gen-4.5 文生视频与图生视频、Gen-4 Turbo 图生视频、Aleph 2.0 视频编辑、Act-Two 角色表演迁移，以及 Gen-4 Image 与 Gen-4 Image Turbo 图片生成；支持 Runway 原生路径、OpenAI 视频接口和 OpenAI 图片接口。
- 通过 Runway 的 `GET /v1/tasks/{id}` 轮询任务并携带必需的 `X-Runway-Version` 请求头；客户端在 `/runway/v1/tasks/{id}` 查询原生任务，输出地址替换为网关下载地址，下载时自动刷新 Runway 会过期的链接。
- 按 Runway 积分计费：提交时按模型、时长和输出格式的官方价预扣，任务成功后按 Runway 返回的 `cost.credits` 结算。
- 在填写媒体 URL 的位置可以传 `{"task_id": ...}` 引用之前的网关任务，例如用 Aleph 2.0 编辑 Gen-4.5 生成的视频。

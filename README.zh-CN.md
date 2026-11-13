---
locale: zh-CN
---
# Runway

[English](README.md) | **简体中文**

通过 [Runway API](https://docs.dev.runwayml.com/)，用 Gen-4.5 与 Gen-4 Turbo 生成视频，用 Aleph 2.0 编辑视频，用 Act-Two 把表演迁移到角色上，用 Gen-4 Image 与 Gen-4 Image Turbo 生成图片。

本插件只覆盖 Runway 自研模型。Runway API 还转售其他厂商的模型（Seedance、Kling、Veo、GPT Image 等），它们各有不同的请求字段和计价规则，本插件不提供。已下线的 `gen3a_turbo` 和 `gen4_aleph` 在 Runway 上已不可用，请改用 `gen4.5` 或 `gen4_turbo`，以及 `aleph2`。

## 渠道设置

- 安装插件后，新建一个"任务插件"类型的渠道，并绑定到 `byaiden_runway`。
- 密钥是在 [Runway Developer Portal](https://dev.runway.com/) 创建的 Runway API secret，填入渠道密钥即可。插件以 `Authorization: Bearer` 发送，并附带 Runway 要求的 `X-Runway-Version: 2024-11-06` 请求头。
- API 地址留空即使用 `https://api.dev.runwayml.com`。只有通过代理访问 Runway 时才填写其他地址，末尾不要带 `/v1`。
- 在渠道里添加要提供的模型：`gen4.5`、`gen4_turbo`、`aleph2`、`act_two`、`gen4_image`、`gen4_image_turbo`。也可以通过模型映射用其他名称提供。

## 模型与接口

| 接口 | 用途 | 模型 |
| --- | --- | --- |
| `POST /v1/text_to_video` | Runway 原生文生视频请求体 | `gen4.5` |
| `POST /v1/image_to_video` | Runway 原生图生视频请求体，`promptImage` 为首帧 | `gen4.5`、`gen4_turbo` |
| `POST /v1/video_to_video` | Aleph 2.0 视频编辑：`videoUri`、`promptText`、按时间点的 `keyframes`、`targetAspectRatio` | `aleph2` |
| `POST /v1/character_performance` | Act-Two：让 `character` 图片或视频按 `reference` 视频表演 | `act_two` |
| `POST /v1/text_to_image` | Runway 原生文生图请求体，最多 3 张 `referenceImages` | `gen4_image`、`gen4_image_turbo` |
| `GET /runway/v1/tasks/{id}` | 查询上述接口提交的任务，返回 Runway 任务对象 | 全部 |
| `POST /v1/videos` | OpenAI 视频接口：`prompt`、`seconds`、`size`、`input_reference`（首帧），以及 Runway 的 `ratio`、`seed`、`outputFormat`、`proresProfile`、`contentModeration` | `gen4.5`、`gen4_turbo` |
| `POST /v1/images/generations` | OpenAI 图片接口：`prompt`、`size`，以及 Runway 的 `ratio`、`seed`、`referenceImages` | `gen4_image`、`gen4_image_turbo` |
| `POST /v1/images/edits` | OpenAI 图片编辑：每张 `image` 都作为参考图 | `gen4_image`、`gen4_image_turbo` |

Runway 原生路径也可以加插件前缀访问，例如 `/byaiden_runway/v1/text_to_video`。网关保留了 `/v1/tasks`，因此任务查询地址是 `/runway/v1/tasks/{id}`（以及 `/byaiden_runway/runway/v1/tasks/{id}`），而不是 Runway 的 `/v1/tasks/{id}`；Runway SDK 自带的轮询因此不能直接对接网关。返回内容保留 Runway 的任务对象，`id` 换成网关任务 ID；任务成功后，每个 `output` 地址都是网关的下载地址，在 Runway 原始链接过期后仍然可用。Runway 的费用信息不会返回给调用方。

通过 `POST /v1/videos` 提交的任务，用 `GET /v1/videos/{task_id}` 查询，用 `GET /v1/videos/{task_id}/content` 下载。OpenAI 图片接口会等待图片生成后直接返回 URL；请求设置 `response_format: "b64_json"` 时返回 base64 数据。网关最多等待 `TASK_PLUGIN_PROTOCOL_TIMEOUT_SECONDS`（默认 600 秒）。

媒体输入为 HTTPS URL 或 data URI（Runway 限制 5 MB 以内）。要使用之前的生成结果，例如用 Aleph 2.0 编辑一个 Gen-4.5 视频，在填 URL 的位置传 `{"task_id": "task_..."}`（可加 `output_index`），例如 `"videoUri": {"task_id": "task_..."}`。网关会确认该任务属于调用方，插件会向 Runway 发送该输出的新鲜下载地址。

## 计费

价格表只有一个字段："Runway 积分单价"。每个任务按其消耗的 Runway 积分计费；按 Runway 官方价，1 积分 = 0.01 美元。额度 = 美元 x 500000。

- 提交任务时，网关按 Runway 公布的价格表预扣积分；任务成功后，按 Runway 在任务里返回的 `cost.credits` 结算。没有返回或返回 0 时保留预扣值。
- Gen-4.5 每秒 12 积分，Gen-4 Turbo 每秒 5 积分，按请求的 `duration`（2 到 10 秒）计算。未填 `ratio` 或 `duration` 的请求按 `1280:720` 和 5 秒发送，使预扣与实际渲染一致。
- Gen-4.5 的 `outputFormat`：`prores` 和 `png_sequence` 每秒加 5 积分，10-bit 与 HDR 格式每秒加 20 积分。
- Aleph 2.0 按输入视频每秒 28 积分（最少 56），Act-Two 按参考表演视频每秒 5 积分。插件无法测量输入视频时长，因此两者都按 Runway 允许的最长输入 30 秒预扣（840 和 150 积分；Aleph 选择 `outputFormat` 时另加对应附加费，`sdr_rec709_10bit` 最多 2040 积分），再按 Runway 返回值结算。调用方余额需要足够覆盖预扣。
- Gen-4 Image 在 720p 比例（`1280:720`、`720:1280`、`720:720`、`960:720`、`720:960`、`1680:720`）下每张 5 积分，其他比例每张 8 积分；未填 `ratio` 时按 `1920:1080` 发送。Gen-4 Image Turbo 每张 2 积分。
- 失败的任务由网关全额退款。Runway 本身对内容审核失败的任务照常收费，所以反复触发审核的请求会消耗渠道所有者的积分，而调用方不付费。

按 Runway 官方价的推荐任务表达式（乘以你的倍率 `M`，例如 `* 1.2`）：

| 模型 | 表达式 |
| --- | --- |
| `gen4.5` | `tier("base", u("credits") * 0.01)` |
| `gen4_turbo` | `tier("base", u("credits") * 0.01)` |
| `aleph2` | `tier("base", u("credits") * 0.01)` |
| `act_two` | `tier("base", u("credits") * 0.01)` |
| `gen4_image` | `tier("base", u("credits") * 0.01)` |
| `gen4_image_turbo` | `tier("base", u("credits") * 0.01)` |

因为每个模型都上报 Runway 实际扣的积分，所以各模型的表达式相同；需要不同利润时，为每个模型保存不同的系数即可。例如 5 秒的 Gen-4.5 视频为 60 积分，按官方价 0.60 美元，额度 300000。设置价格前请查看 [Runway 价格页](https://docs.dev.runwayml.com/guides/pricing)。

## 示例

```bash
curl https://your-gateway.example.com/v1/image_to_video \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gen4.5", "promptText": "The camera slowly pushes in as leaves drift past", "promptImage": "https://example.com/first-frame.jpg", "ratio": "1280:720", "duration": 5}'
```

用返回的 `id` 查询任务：

```bash
curl https://your-gateway.example.com/runway/v1/tasks/{id} \
  -H "Authorization: Bearer $NEWAPI_TOKEN"
```

通过 OpenAI 视频接口生成视频：

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gen4.5", "prompt": "A paper boat drifting on a calm pond", "seconds": 5, "size": "1280x720"}'
```

## 限制

- `promptText` 最多 1000 个字符。Gen-4.5 必须填写提示词；Gen-4 Turbo 和 Aleph 2.0 可选（Aleph 需要提示词或关键帧之一）。
- Gen-4.5 文生视频的 `ratio` 为 `1280:720` 或 `720:1280`；两个视频模型的图生视频支持 `1280:720`、`720:1280`、`1104:832`、`832:1104`、`960:960`、`1584:672`。在 `POST /v1/videos` 上，`size` 必须是其中之一，写成 `宽x高`。
- Aleph 2.0 编辑 2 到 30 秒的视频，最多 5 个关键帧；已弃用的 `ratio` 字段会被拒绝，扩展画幅请用 `targetAspectRatio`。Act-Two 参考视频为 3 到 30 秒。
- Gen-4 Image Turbo 需要 1 到 3 张参考图，Gen-4 Image 最多 3 张。参考图 `tag` 为 3 到 16 位字母、数字或下划线，以字母开头，在提示词中以 `@tag` 引用。每次请求返回一张图，`n` 必须为 1。
- 含有 Runway 未为该模型记载的字段、`callback_url` 或 `runway://` 上传地址（网关自身 Runway 账号的文件）的请求会被拒绝。Runway 的其他接口（上传、音频、超分、Recipes、Characters、Workflows、Model Router）不提供。
- Runway 生成接口不是幂等的：重试提交会新建任务并再次扣费。

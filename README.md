---
translations:
  zh-CN: README.zh-CN.md
---
# Runway

**English** | [简体中文](README.zh-CN.md)

Generates videos with Runway's Gen-4.5 and Gen-4 Turbo, edits videos with Aleph 2.0, transfers a performance onto a character with Act-Two, and generates images with Gen-4 Image and Gen-4 Image Turbo, through the [Runway API](https://docs.dev.runwayml.com/).

The plugin covers Runway's own models. Runway's API also resells other labs' models (Seedance, Kling, Veo, GPT Image and more), each with its own request fields and price rules; those are not offered here. The retired `gen3a_turbo` and `gen4_aleph` no longer work on Runway; use `gen4.5` or `gen4_turbo`, and `aleph2`.

## Channel setup

- Install the plugin, then add a channel of the Task Plugin type and bind it to `byaiden_runway`.
- The key is a Runway API secret from the [Runway Developer Portal](https://dev.runway.com/). Paste it as the channel key; the plugin sends it as `Authorization: Bearer` together with the required `X-Runway-Version: 2024-11-06` header.
- Leave the API address empty to use `https://api.dev.runwayml.com`. Enter another address only when you reach Runway through a proxy, and leave `/v1` off the end.
- Add the models you offer to the channel: `gen4.5`, `gen4_turbo`, `aleph2`, `act_two`, `gen4_image`, `gen4_image_turbo`. A channel can also offer them under other names through model mapping.

## Models and endpoints

| Endpoint | What it does | Models |
| --- | --- | --- |
| `POST /v1/text_to_video` | Runway's text to video body | `gen4.5` |
| `POST /v1/image_to_video` | Runway's image to video body, `promptImage` is the first frame | `gen4.5`, `gen4_turbo` |
| `POST /v1/video_to_video` | Runway's Aleph 2.0 video edit: `videoUri`, `promptText`, timed `keyframes`, `targetAspectRatio` | `aleph2` |
| `POST /v1/character_performance` | Act-Two: a `character` image or video performs the `reference` video | `act_two` |
| `POST /v1/text_to_image` | Runway's text to image body with up to three `referenceImages` | `gen4_image`, `gen4_image_turbo` |
| `GET /runway/v1/tasks/{id}` | Runway's task object for a task submitted on the paths above | all |
| `POST /v1/videos` | OpenAI video API: `prompt`, `seconds`, `size`, `input_reference` (first frame), plus Runway's `ratio`, `seed`, `outputFormat`, `proresProfile` and `contentModeration` | `gen4.5`, `gen4_turbo` |
| `POST /v1/images/generations` | OpenAI Images API: `prompt`, `size`, plus Runway's `ratio`, `seed`, `referenceImages` | `gen4_image`, `gen4_image_turbo` |
| `POST /v1/images/edits` | OpenAI image edits: every `image` becomes a reference image | `gen4_image`, `gen4_image_turbo` |

Runway's own paths are also served under the plugin's prefix, for example `/byaiden_runway/v1/text_to_video`. The gateway reserves `/v1/tasks`, so the task query lives at `/runway/v1/tasks/{id}` (and `/byaiden_runway/runway/v1/tasks/{id}`) instead of Runway's `/v1/tasks/{id}`; the Runway SDKs' built-in polling therefore does not work against the gateway. The reply keeps Runway's task object with the gateway task id; when the task has succeeded, each `output` URL is the gateway's download address, which keeps working after Runway's own link expires. Runway's cost details are left out.

For a task from `POST /v1/videos`, clients poll `GET /v1/videos/{task_id}` and download the file from `GET /v1/videos/{task_id}/content`. The OpenAI Images endpoints wait for the image and answer with its URL, or with base64 data when the request sets `response_format: "b64_json"`; the gateway waits up to `TASK_PLUGIN_PROTOCOL_TIMEOUT_SECONDS` (600 seconds by default).

Media inputs are HTTPS URLs or data URIs (up to 5 MB, as Runway accepts them). To use an earlier result, such as editing a Gen-4.5 video with Aleph 2.0, pass `{"task_id": "task_..."}` (optionally with `output_index`) where a URL goes, for example `"videoUri": {"task_id": "task_..."}`. The gateway checks that the task belongs to the caller, and the plugin sends a fresh Runway URL of that output.

## Billing

The price table has one field, "Runway credit unit price". Each task is charged by the Runway credits it costs; one credit is USD 0.01 at Runway's list price. Quota is USD x 500000.

- When the task is submitted, the gateway reserves the credits from Runway's published price table. When the task succeeds, it settles on the `cost.credits` Runway reports for the task. A missing or zero count keeps the reservation.
- Gen-4.5 is 12 credits per second and Gen-4 Turbo 5 credits per second of the requested `duration` (2 to 10 seconds). A request without `ratio` or `duration` is sent as `1280:720` and 5 seconds, so the reservation matches what Runway renders.
- Gen-4.5 `outputFormat` adds 5 credits per second for `prores` and `png_sequence`, and 20 credits per second for the 10-bit and HDR formats.
- Aleph 2.0 is 28 credits per second of the input video (56 at least), and Act-Two 5 credits per second of the reference performance. The plugin cannot measure the input video, so both reserve 30 seconds, the longest input Runway takes (840 and 150 credits; an Aleph `outputFormat` reserves its surcharge on top, up to 2040 credits for `sdr_rec709_10bit`), and settle on what Runway reports. The caller needs enough balance for the reservation.
- Gen-4 Image is 5 credits for a 720p `ratio` (`1280:720`, `720:1280`, `720:720`, `960:720`, `720:960`, `1680:720`) and 8 credits for every other ratio; a request without `ratio` is sent as `1920:1080`. Gen-4 Image Turbo is 2 credits per image.
- Failed tasks are refunded in full by the gateway. Runway itself charges content-moderation failures like successful generations, so repeated moderated requests cost the channel owner credits that callers do not pay.

Recommended task expressions at Runway's list price, per model (multiply by your margin `M`, for example `* 1.2`):

| Model | Expression |
| --- | --- |
| `gen4.5` | `tier("base", u("credits") * 0.01)` |
| `gen4_turbo` | `tier("base", u("credits") * 0.01)` |
| `aleph2` | `tier("base", u("credits") * 0.01)` |
| `act_two` | `tier("base", u("credits") * 0.01)` |
| `gen4_image` | `tier("base", u("credits") * 0.01)` |
| `gen4_image_turbo` | `tier("base", u("credits") * 0.01)` |

Because every model reports the credits Runway charges, the expression is the same for each; save a different factor per model to give models different margins. For example, a 5-second Gen-4.5 video is 60 credits, USD 0.60, quota 300000 at list price. Check the [Runway pricing page](https://docs.dev.runwayml.com/guides/pricing) when you set prices.

## Example

```bash
curl https://your-gateway.example.com/v1/image_to_video \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gen4.5", "promptText": "The camera slowly pushes in as leaves drift past", "promptImage": "https://example.com/first-frame.jpg", "ratio": "1280:720", "duration": 5}'
```

Poll the task with the `id` from the reply:

```bash
curl https://your-gateway.example.com/runway/v1/tasks/{id} \
  -H "Authorization: Bearer $NEWAPI_TOKEN"
```

A video through the OpenAI video API:

```bash
curl https://your-gateway.example.com/v1/videos \
  -H "Authorization: Bearer $NEWAPI_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gen4.5", "prompt": "A paper boat drifting on a calm pond", "seconds": 5, "size": "1280x720"}'
```

## Limits

- `promptText` is at most 1000 characters. Gen-4.5 needs a prompt; Gen-4 Turbo and Aleph 2.0 take an optional one (Aleph needs a prompt or keyframes).
- Gen-4.5 text to video takes `ratio` `1280:720` or `720:1280`; image to video on both video models takes `1280:720`, `720:1280`, `1104:832`, `832:1104`, `960:960` and `1584:672`. On `POST /v1/videos`, `size` must be one of these written as `WIDTHxHEIGHT`.
- Aleph 2.0 edits videos of 2 to 30 seconds with up to 5 keyframes; its deprecated `ratio` field is rejected, use `targetAspectRatio` to expand the frame. Act-Two reference videos are 3 to 30 seconds.
- Gen-4 Image Turbo needs 1 to 3 reference images; Gen-4 Image takes up to 3. A reference `tag` is 3 to 16 letters, digits or underscores starting with a letter, and is named in the prompt as `@tag`. Each request returns one image, so `n` must be 1.
- Requests with fields Runway does not document for the model, `callback_url`, or `runway://` upload URIs (files of the gateway's own Runway account) are rejected. Runway's other endpoints (uploads, audio, upscaling, recipes, Characters, workflows, model routers) are not offered.
- Runway generation is not idempotent: a retried submission starts and charges a new task.

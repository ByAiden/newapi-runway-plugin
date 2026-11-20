// Runway API (docs.dev.runwayml.com): Runway's own models. Gen-4.5 text to
// video and image to video, Gen-4 Turbo image to video, Aleph 2.0 video
// editing, Act-Two character performance, and Gen-4 Image / Gen-4 Image
// Turbo. Every operation is a POST that returns a task id, polled at
// GET /v1/tasks/{id}. Every request carries the X-Runway-Version header.
const PLUGIN_KEY = "byaiden_runway";
const RUNWAY_VERSION = "2024-11-06";
const MODELS = ["gen4.5", "gen4_turbo", "aleph2", "act_two", "gen4_image", "gen4_image_turbo"];
const VIDEO_MODELS = ["gen4.5", "gen4_turbo", "aleph2", "act_two"];
const IMAGE_MODELS = ["gen4_image", "gen4_image_turbo"];

// The Runway endpoint of each operation and the models it serves.
const OPERATIONS = {
  text_to_video: { path: "/v1/text_to_video", models: ["gen4.5"] },
  image_to_video: { path: "/v1/image_to_video", models: ["gen4.5", "gen4_turbo"] },
  video_to_video: { path: "/v1/video_to_video", models: ["aleph2"] },
  character_performance: { path: "/v1/character_performance", models: ["act_two"] },
  text_to_image: { path: "/v1/text_to_image", models: ["gen4_image", "gen4_image_turbo"] },
};

const MAX_PROMPT_LENGTH = 1000;
const MAX_SEED = 4294967295;
const MIN_DURATION = 2;
const MAX_DURATION = 10;
const DEFAULT_DURATION = 5;
const DEFAULT_VIDEO_RATIO = "1280:720";
const DEFAULT_IMAGE_RATIO = "1920:1080";
const TEXT_TO_VIDEO_RATIOS = ["1280:720", "720:1280"];
const IMAGE_TO_VIDEO_RATIOS = ["1280:720", "720:1280", "1104:832", "832:1104", "960:960", "1584:672"];
const IMAGE_RATIOS = ["1920:1080", "1080:1920", "1024:1024", "1360:768", "1080:1080", "1168:880", "1440:1080", "1080:1440", "1808:768", "2112:912", "1280:720", "720:1280", "720:720", "960:720", "720:960", "1680:720"];
// gen4_image bills these sizes as 720p images and every other size as 1080p.
const IMAGE_RATIOS_720P = ["1280:720", "720:1280", "720:720", "960:720", "720:960", "1680:720"];
const TARGET_ASPECT_RATIOS = ["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "9:16", "21:9"];
const GEN45_OUTPUT_FORMATS = ["mp4", "prores", "png_sequence", "hdr10", "hlg", "sdr_rec709_10bit", "hdr_pq_12bit_master", "hdr_prores", "hdr_png_sequence", "hdr_exr_sequence", "hdr_exr_acescg_sequence_1_3", "hdr_exr_acescg_sequence_2_0"];
const ALEPH_OUTPUT_FORMATS = ["mp4", "prores", "png_sequence", "sdr_rec709_10bit"];
const PRORES_PROFILES = ["422", "4444", "422 Proxy", "422 LT", "422 HQ", "4444 XQ"];
const HDR_PRORES_PROFILES = ["422", "422 HQ", "4444"];
const PUBLIC_FIGURE_THRESHOLDS = ["auto", "low"];
const MAX_REFERENCE_IMAGES = 3;
const MAX_KEYFRAMES = 5;
// Aleph 2.0 edits an input video of at most 30 seconds, and Act-Two follows a
// reference performance of 3 to 30 seconds; the output is as long as that
// video, which the plugin cannot measure, so both reserve 30 seconds.
const MAX_INPUT_VIDEO_SECONDS = 30;
// Runway reads data URIs up to 5 MB, so an uploaded file may hold this many
// bytes before base64 encoding.
const MAX_UPLOAD_BYTES = 3750000;

// Runway's published list prices in credits ($0.01 each,
// docs.dev.runwayml.com/guides/pricing). They reserve a task's charge; a
// finished task settles on the cost.credits Runway reports.
const CREDITS_PER_SECOND = { "gen4.5": 12, gen4_turbo: 5, aleph2: 28, act_two: 5 };
const MIN_CREDITS = { aleph2: 56 };
// Per-second surcharges of the professional output formats. The 10-bit and
// HDR formats cost 20 credits per second, or 40 above 4 megapixels: Gen-4.5
// renders 720p, while an Aleph edit keeps the size of its input video.
const PRO_FORMAT_SURCHARGE = { prores: 5, png_sequence: 5 };
const DEEP_FORMAT_SURCHARGE = 20;
const DEEP_FORMAT_SURCHARGE_LARGE = 40;
const IMAGE_CREDITS = { gen4_image_turbo: 2 };
const GEN4_IMAGE_CREDITS = { "720p": 5, "1080p": 8 };
// The dearest single task: a 30-second Aleph edit in 10-bit above 4 megapixels.
const MAX_CREDITS = 2040;

export const meta = {
  "apiVersion": 1,
  "key": "byaiden_runway",
  "name": "Runway",
  "icon": "Runway",
  "description": {
    "en": "Runway Gen-4.5 and Gen-4 Turbo video, Aleph 2.0 video editing, Act-Two character performance, and Gen-4 Image generation",
    "zh": "Runway Gen-4.5 与 Gen-4 Turbo 视频生成、Aleph 2.0 视频编辑、Act-Two 角色表演迁移与 Gen-4 Image 图片生成"
  },
  "version": "1.1.1",
  "author": {
    "name": "ByAiden",
    "url": "https://github.com/ByAiden"
  },
  "website": "https://docs.dev.runwayml.com/",
  "baseUrl": "https://api.dev.runwayml.com",
  "upstreams": [
    "vendor",
    "new_api"
  ],
  "models": [
    "gen4.5",
    "gen4_turbo",
    "aleph2",
    "act_two",
    "gen4_image",
    "gen4_image_turbo"
  ],
  "fetchMode": "per_task",
  "usageSchema": {
    "credits": {
      "type": "number",
      "unit": "credit",
      "description": {
        "en": "Runway credit unit price",
        "zh": "Runway 积分单价"
      }
    }
  },
  "usageExamples": [
    {
      "label": "gen4.5 5s",
      "facts": {
        "credits": 60
      }
    },
    {
      "label": "gen4.5 10s",
      "facts": {
        "credits": 120
      }
    },
    {
      "label": "gen4.5 5s hdr10",
      "facts": {
        "credits": 160
      }
    },
    {
      "label": "gen4_turbo 5s",
      "facts": {
        "credits": 25
      }
    },
    {
      "label": "aleph2 10s edit",
      "facts": {
        "credits": 280
      }
    },
    {
      "label": "act_two 10s",
      "facts": {
        "credits": 50
      }
    },
    {
      "label": "gen4_image 1080p",
      "facts": {
        "credits": 8
      }
    },
    {
      "label": "gen4_image 720p",
      "facts": {
        "credits": 5
      }
    },
    {
      "label": "gen4_image_turbo",
      "facts": {
        "credits": 2
      }
    }
  ],
  "routes": [
    {
      "method": "POST",
      "path": "/v1/text_to_video",
      "type": "submit",
      "decode": "textToVideo",
      "render": "taskCreated",
      "models": [
        "gen4.5"
      ]
    },
    {
      "method": "POST",
      "path": "/v1/image_to_video",
      "type": "submit",
      "decode": "imageToVideo",
      "render": "taskCreated",
      "models": [
        "gen4.5",
        "gen4_turbo"
      ]
    },
    {
      "method": "POST",
      "path": "/v1/video_to_video",
      "type": "submit",
      "decode": "videoToVideo",
      "render": "taskCreated",
      "models": [
        "aleph2"
      ]
    },
    {
      "method": "POST",
      "path": "/v1/character_performance",
      "type": "submit",
      "decode": "characterPerformance",
      "render": "taskCreated",
      "models": [
        "act_two"
      ]
    },
    {
      "method": "POST",
      "path": "/v1/text_to_image",
      "type": "submit",
      "decode": "textToImage",
      "render": "taskCreated",
      "models": [
        "gen4_image",
        "gen4_image_turbo"
      ]
    },
    {
      "method": "GET",
      "path": "/runway/v1/tasks/:id",
      "type": "query",
      "taskIdParam": "id",
      "render": "taskStatus"
    }
  ],
  "protocols": [
    {
      "name": "openai_video",
      "models": [
        "gen4.5",
        "gen4_turbo"
      ]
    },
    {
      "name": "openai_image",
      "models": [
        "gen4_image",
        "gen4_image_turbo"
      ]
    }
  ]
};

function trimmed(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function present(value) {
  return value !== undefined && value !== null;
}

function given(value) {
  return present(value) && value !== "";
}

function isPlaceholder(value) {
  return Boolean(plainObject(value) && value.__fileRef);
}

// The model the channel sends upstream: the mapped name when there is one,
// otherwise the client's. A mapping to a retired or unknown name is an error
// rather than a silent fallback to the client's model.
function upstreamModel(identity) {
  const name = trimmed(identity.upstreamModel) || trimmed(identity.model);
  if (!MODELS.includes(name)) throw new Error((name || "model") + " is not a supported Runway model; use " + MODELS.join(", "));
  return name;
}

function checkOperation(operation, model) {
  const entry = OPERATIONS[operation];
  if (!entry) throw new Error("unknown operation " + operation);
  if (!entry.models.includes(model)) throw new Error(model + " does not serve " + entry.path + "; use " + entry.models.join(", "));
}

function enumValue(value, name, allowed) {
  const text = trimmed(value);
  if (!allowed.includes(text)) throw new Error(name + " must be one of " + allowed.join(", "));
  return text;
}

function integerValue(value, name, min, max) {
  const number = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isInteger(number) || number < min || number > max) throw new Error(name + " must be an integer from " + min + " to " + max);
  return number;
}

function booleanValue(value, name) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "false") return value === "true";
  throw new Error(name + " must be true or false");
}

function promptText(value, required) {
  if (!present(value)) {
    if (required) throw new Error("promptText is required");
    return "";
  }
  if (typeof value !== "string") throw new Error("promptText must be a string");
  const text = value.trim();
  if (!text) {
    if (required) throw new Error("promptText is required");
    return "";
  }
  if (text.length > MAX_PROMPT_LENGTH) throw new Error("promptText must be at most " + MAX_PROMPT_LENGTH + " characters");
  return text;
}

// A media input: an HTTPS URL, a data URI, a gateway upload placeholder, or
// {task_id, output_index?} naming the output of an earlier gateway task. A
// runway:// upload URI would name a file of the gateway's own Runway account,
// which callers must not reach.
function mediaValue(value, name) {
  if (isPlaceholder(value)) return value;
  const object = plainObject(value);
  if (object) {
    const keys = Object.keys(object);
    if (!present(object.task_id) || keys.some((key) => key !== "task_id" && key !== "output_index")) throw new Error(name + " must be an HTTPS URL, a data URI or {task_id}");
    const taskId = trimmed(object.task_id);
    if (!taskId) throw new Error(name + ".task_id must not be empty");
    const ref = { task_id: taskId };
    if (present(object.output_index)) ref.output_index = integerValue(object.output_index, name + ".output_index", 0, 63);
    return ref;
  }
  if (typeof value !== "string" || !value.trim()) throw new Error(name + " must be an HTTPS URL, a data URI or {task_id}");
  const text = value.trim();
  if (/^runway:\/\//i.test(text)) throw new Error(name + " must not be a runway:// upload URI; pass an HTTPS URL or a data URI");
  if (!/^https:\/\//i.test(text) && !/^data:/i.test(text)) throw new Error(name + " must be an HTTPS URL or a data URI");
  if (/^https:\/\//i.test(text) && text.length > 2048) throw new Error(name + " must be at most 2048 characters");
  return text;
}

function contentModeration(value) {
  const object = plainObject(value);
  if (!object) throw new Error("contentModeration must be an object");
  for (const key of Object.keys(object)) {
    if (key !== "publicFigureThreshold") throw new Error("contentModeration." + key + " is not supported");
  }
  const out = {};
  if (present(object.publicFigureThreshold)) out.publicFigureThreshold = enumValue(object.publicFigureThreshold, "contentModeration.publicFigureThreshold", PUBLIC_FIGURE_THRESHOLDS);
  return out;
}

function rejectUnknown(source, allowed) {
  for (const key of Object.keys(source)) {
    if (key === "callback_url" || key === "callbackUrl") throw new Error(key + " is not supported; poll the task instead");
    if (!allowed.includes(key)) throw new Error(key + " is not supported on this model");
  }
}

function outputOptions(source, body, formats) {
  if (present(source.outputFormat)) body.outputFormat = enumValue(source.outputFormat, "outputFormat", formats);
  if (present(source.proresProfile)) {
    if (body.outputFormat === "prores") body.proresProfile = enumValue(source.proresProfile, "proresProfile", PRORES_PROFILES);
    else if (body.outputFormat === "hdr_prores") body.proresProfile = enumValue(source.proresProfile, "proresProfile", HDR_PRORES_PROFILES);
    else throw new Error("proresProfile needs outputFormat prores" + (formats.includes("hdr_prores") ? " or hdr_prores" : ""));
  }
}

function commonOptions(source, body) {
  if (present(source.seed)) body.seed = integerValue(source.seed, "seed", 0, MAX_SEED);
  if (present(source.contentModeration)) body.contentModeration = contentModeration(source.contentModeration);
}

// Gen-4.5 and Gen-4 Turbo videos. Ratio and duration are always sent, so the
// reserved charge matches what Runway renders even if its defaults change.
function videoRequest(source, model, operation) {
  const allowed = ["model", "promptText", "ratio", "duration", "seed", "contentModeration"];
  if (operation === "image_to_video") allowed.push("promptImage");
  if (model === "gen4.5") allowed.push("outputFormat", "proresProfile");
  rejectUnknown(source, allowed);
  const body = {};
  const prompt = promptText(source.promptText, model === "gen4.5");
  if (prompt) body.promptText = prompt;
  if (operation === "image_to_video") {
    if (!present(source.promptImage)) throw new Error("promptImage is required");
    body.promptImage = promptImage(source.promptImage);
  }
  const ratios = operation === "text_to_video" ? TEXT_TO_VIDEO_RATIOS : IMAGE_TO_VIDEO_RATIOS;
  body.ratio = present(source.ratio) ? enumValue(source.ratio, "ratio", ratios) : DEFAULT_VIDEO_RATIO;
  body.duration = present(source.duration) ? integerValue(source.duration, "duration", MIN_DURATION, MAX_DURATION) : DEFAULT_DURATION;
  commonOptions(source, body);
  if (model === "gen4.5") outputOptions(source, body, GEN45_OUTPUT_FORMATS);
  return body;
}

// promptImage is one image, or Runway's array form with a single first frame.
function promptImage(value) {
  if (!Array.isArray(value)) return mediaValue(value, "promptImage");
  if (value.length !== 1) throw new Error("promptImage takes exactly one image");
  const frame = plainObject(value[0]);
  if (!frame) throw new Error("promptImage[0] must be an object with uri and position");
  if (present(frame.position) && frame.position !== "first") throw new Error("promptImage[0].position must be first");
  for (const key of Object.keys(frame)) {
    if (key !== "uri" && key !== "position") throw new Error("promptImage[0]." + key + " is not supported");
  }
  return [{ uri: mediaValue(frame.uri, "promptImage[0].uri"), position: "first" }];
}

function keyframeList(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_KEYFRAMES) throw new Error("keyframes must hold 1 to " + MAX_KEYFRAMES + " images");
  let ranged = 0;
  const frames = value.map(function (item, index) {
    const name = "keyframes[" + index + "]";
    const frame = plainObject(item);
    if (!frame) throw new Error(name + " must be an object");
    for (const key of Object.keys(frame)) {
      if (!["uri", "seconds", "at", "range"].includes(key)) throw new Error(name + "." + key + " is not supported");
    }
    const out = { uri: mediaValue(frame.uri, name + ".uri") };
    if (present(frame.seconds) === present(frame.at)) throw new Error(name + " needs exactly one of seconds or at");
    if (present(frame.seconds)) {
      if (typeof frame.seconds !== "number" || !(frame.seconds >= 0 && frame.seconds <= MAX_INPUT_VIDEO_SECONDS)) throw new Error(name + ".seconds must be a number from 0 to " + MAX_INPUT_VIDEO_SECONDS);
      out.seconds = frame.seconds;
    } else {
      if (typeof frame.at !== "number" || !(frame.at >= 0 && frame.at <= 1)) throw new Error(name + ".at must be a number from 0 to 1");
      out.at = frame.at;
    }
    if (present(frame.range)) {
      const range = plainObject(frame.range);
      if (!range) throw new Error(name + ".range must be an object");
      const start = integerValue(range.start_seconds, name + ".range.start_seconds", 0, MAX_INPUT_VIDEO_SECONDS);
      const end = integerValue(range.end_seconds, name + ".range.end_seconds", 1, MAX_INPUT_VIDEO_SECONDS);
      if (end <= start) throw new Error(name + ".range.end_seconds must be after start_seconds");
      out.range = { start_seconds: start, end_seconds: end };
      ranged++;
    }
    return out;
  });
  if (ranged && ranged !== frames.length) throw new Error("either every keyframe sets a range or none does");
  return frames;
}

// Aleph 2.0 edits a video of 2 to 30 seconds.
function alephRequest(source) {
  if (present(source.ratio)) throw new Error("ratio is not supported on aleph2; use targetAspectRatio to expand the frame");
  rejectUnknown(source, ["model", "promptText", "videoUri", "keyframes", "seed", "targetAspectRatio", "contentModeration", "outputFormat", "proresProfile"]);
  if (!present(source.videoUri)) throw new Error("videoUri is required");
  const body = { videoUri: mediaValue(source.videoUri, "videoUri") };
  const prompt = promptText(source.promptText, false);
  if (prompt) body.promptText = prompt;
  if (present(source.keyframes)) body.keyframes = keyframeList(source.keyframes);
  if (!body.promptText && !body.keyframes) throw new Error("aleph2 needs promptText or keyframes");
  if (present(source.targetAspectRatio)) body.targetAspectRatio = enumValue(source.targetAspectRatio, "targetAspectRatio", TARGET_ASPECT_RATIOS);
  commonOptions(source, body);
  outputOptions(source, body, ALEPH_OUTPUT_FORMATS);
  return body;
}

function performer(value, name, types) {
  const object = plainObject(value);
  if (!object || isPlaceholder(value)) throw new Error(name + " must be an object with type and uri");
  for (const key of Object.keys(object)) {
    if (key !== "type" && key !== "uri") throw new Error(name + "." + key + " is not supported");
  }
  return { type: enumValue(object.type, name + ".type", types), uri: mediaValue(object.uri, name + ".uri") };
}

// Act-Two moves a character image or video with a reference performance.
function actTwoRequest(source) {
  rejectUnknown(source, ["model", "character", "reference", "bodyControl", "expressionIntensity", "ratio", "seed", "contentModeration"]);
  if (!present(source.character)) throw new Error("character is required");
  if (!present(source.reference)) throw new Error("reference is required");
  const body = { character: performer(source.character, "character", ["image", "video"]), reference: performer(source.reference, "reference", ["video"]) };
  if (present(source.bodyControl)) body.bodyControl = booleanValue(source.bodyControl, "bodyControl");
  if (present(source.expressionIntensity)) body.expressionIntensity = integerValue(source.expressionIntensity, "expressionIntensity", 1, 5);
  if (present(source.ratio)) body.ratio = enumValue(source.ratio, "ratio", IMAGE_TO_VIDEO_RATIOS);
  commonOptions(source, body);
  return body;
}

// Gen-4 Image takes up to three reference images, Gen-4 Image Turbo one to
// three. A tag names a reference in the prompt as @tag.
function imageRequest(source, model) {
  rejectUnknown(source, ["model", "promptText", "ratio", "referenceImages", "seed", "contentModeration"]);
  const body = { promptText: promptText(source.promptText, true) };
  body.ratio = present(source.ratio) ? enumValue(source.ratio, "ratio", IMAGE_RATIOS) : DEFAULT_IMAGE_RATIO;
  const refs = present(source.referenceImages) ? source.referenceImages : [];
  if (!Array.isArray(refs)) throw new Error("referenceImages must be an array");
  if (refs.length > MAX_REFERENCE_IMAGES) throw new Error("referenceImages takes at most " + MAX_REFERENCE_IMAGES + " images");
  if (model === "gen4_image_turbo" && !refs.length) throw new Error("gen4_image_turbo needs 1 to " + MAX_REFERENCE_IMAGES + " referenceImages");
  if (refs.length)
    body.referenceImages = refs.map(function (item, index) {
      const name = "referenceImages[" + index + "]";
      const ref = plainObject(item) && !isPlaceholder(item) && present(item.uri) ? item : { uri: item };
      for (const key of Object.keys(ref)) {
        if (key !== "uri" && key !== "tag") throw new Error(name + "." + key + " is not supported");
      }
      const out = { uri: mediaValue(ref.uri, name + ".uri") };
      if (present(ref.tag)) {
        const tag = trimmed(ref.tag);
        if (!/^[A-Za-z][A-Za-z0-9_]{2,15}$/.test(tag)) throw new Error(name + ".tag must be 3 to 16 letters, digits or underscores, starting with a letter");
        out.tag = tag;
      }
      return out;
    });
  commonOptions(source, body);
  return body;
}

// Validates a Runway request body for one operation and keeps only the
// fields Runway documents for that model, so an unlisted field cannot change
// what the reserved charge covers.
function runwayRequest(source, model, operation) {
  checkOperation(operation, model);
  if (operation === "video_to_video") return alephRequest(source);
  if (operation === "character_performance") return actTwoRequest(source);
  if (operation === "text_to_image") return imageRequest(source, model);
  return videoRequest(source, model, operation);
}

function formatSurcharge(format, large) {
  if (!format || format === "mp4") return 0;
  if (PRO_FORMAT_SURCHARGE[format]) return PRO_FORMAT_SURCHARGE[format];
  return large ? DEEP_FORMAT_SURCHARGE_LARGE : DEEP_FORMAT_SURCHARGE;
}

// The credits a request reserves on the model the channel sends upstream.
function estimatedCredits(body, model) {
  let credits;
  if (model === "gen4_image") credits = GEN4_IMAGE_CREDITS[IMAGE_RATIOS_720P.includes(body.ratio) ? "720p" : "1080p"];
  else if (IMAGE_CREDITS[model]) credits = IMAGE_CREDITS[model];
  else {
    const seconds = model === "aleph2" || model === "act_two" ? MAX_INPUT_VIDEO_SECONDS : body.duration;
    credits = (CREDITS_PER_SECOND[model] + formatSurcharge(body.outputFormat, model === "aleph2")) * seconds;
    credits = Math.max(credits, MIN_CREDITS[model] || 0);
  }
  if (!(credits > 0)) throw new Error(model + " has no Runway price");
  return Math.min(credits, MAX_CREDITS);
}

// Every earlier gateway task the body names, in the order Runway reads them.
function originIds(body) {
  const ids = [];
  const visit = function (value) {
    if (Array.isArray(value)) return value.forEach(visit);
    const object = plainObject(value);
    if (!object || isPlaceholder(value)) return;
    if (typeof object.task_id === "string") {
      if (!ids.includes(object.task_id)) ids.push(object.task_id);
      return;
    }
    Object.keys(object).forEach((key) => visit(object[key]));
  };
  visit(body);
  return ids;
}

function outputURLs(data) {
  const object = plainObject(data);
  if (!object || object.status !== "SUCCEEDED" || !Array.isArray(object.output)) return [];
  return object.output.map(trimmed);
}

// On a New API channel the same plugin answers on another gateway, which
// serves Runway's paths under the plugin key and takes its own token; the
// query route is its /runway/v1/tasks/{id}.
function viaGateway(ctx) {
  return Boolean(ctx && ctx.upstream && ctx.upstream.kind === "new_api");
}

function apiRoot(ctx) {
  return ctx.baseUrl + (viaGateway(ctx) ? "/" + PLUGIN_KEY : "");
}

function taskURL(ctx, id) {
  return apiRoot(ctx) + (viaGateway(ctx) ? "/runway/v1/tasks/" : "/v1/tasks/") + encodeURIComponent(id);
}

function taskHeaders(ctx) {
  if (viaGateway(ctx)) return { Accept: "application/json", Authorization: trimmed(ctx.authHeader) || "Bearer " + ctx.apiKey };
  return { Accept: "application/json", Authorization: "Bearer " + ctx.apiKey, "X-Runway-Version": RUNWAY_VERSION };
}

// Replaces {task_id} references with the output URLs of the tasks the gateway
// resolved for this request. Runway's URLs expire after a day or two, so each
// task is read again for a fresh URL (up to four lookups per request), with
// the last polled snapshot as the fallback.
function withOriginURLs(body, ctx) {
  const ids = originIds(body);
  if (!ids.length) return body;
  const tasks = {};
  for (const task of ctx.originTasks || []) {
    if (task && task.taskId) tasks[task.taskId] = task;
  }
  // The upstream gateway resolves references to its own tasks itself.
  if (viaGateway(ctx)) return withUpstreamTaskIds(body, ids, tasks);
  const outputs = {};
  let lookups = 0;
  for (const id of ids) {
    const task = tasks[id];
    if (!task || !trimmed(task.upstreamTaskId)) throw new Error("task " + id + " is not available");
    let urls = [];
    if (lookups < 4) {
      lookups++;
      try {
        const response = utils.fetch({ url: taskURL(ctx, trimmed(task.upstreamTaskId)), headers: taskHeaders(ctx) });
        if (response.status === 200) urls = outputURLs(response.body);
      } catch (_error) {
        urls = [];
      }
    }
    if (!urls.length) urls = outputURLs(task.data);
    if (!urls.length) throw new Error("task " + id + " has no finished output");
    outputs[id] = urls;
  }
  const swap = function (value) {
    if (Array.isArray(value)) return value.map(swap);
    const object = plainObject(value);
    if (!object || isPlaceholder(value)) return value;
    if (typeof object.task_id === "string") {
      const url = outputs[object.task_id][object.output_index || 0];
      if (!url) throw new Error("task " + object.task_id + " has no output " + (object.output_index || 0));
      return url;
    }
    const out = {};
    for (const key of Object.keys(object)) out[key] = swap(object[key]);
    return out;
  };
  return swap(body);
}

// Replaces each {task_id} reference with the id the upstream gateway gave
// that task.
function withUpstreamTaskIds(body, ids, tasks) {
  const upstream = {};
  for (const id of ids) {
    const task = tasks[id];
    if (!task || !trimmed(task.upstreamTaskId)) throw new Error("task " + id + " is not available");
    upstream[id] = trimmed(task.upstreamTaskId);
  }
  const swap = function (value) {
    if (Array.isArray(value)) return value.map(swap);
    const object = plainObject(value);
    if (!object || isPlaceholder(value)) return value;
    if (typeof object.task_id === "string") return Object.assign({}, object, { task_id: upstream[object.task_id] });
    const out = {};
    for (const key of Object.keys(object)) out[key] = swap(object[key]);
    return out;
  };
  return swap(body);
}

function submitIntent(model, operation, body) {
  const intent = { kind: "submit", model: model, action: operation, requestBody: Object.assign({}, body, { model: model }) };
  const ids = originIds(body);
  if (ids.length) intent.originTaskIds = ids;
  return intent;
}

function operationOf(ctx, model) {
  const action = trimmed(ctx.action);
  if (OPERATIONS[action]) return action;
  // Fallback when the host passes no action: the model's only endpoint, or
  // image to video when a first frame is given.
  if (model === "gen4.5") return present((ctx.requestBody || {}).promptImage) ? "image_to_video" : "text_to_video";
  for (const name of Object.keys(OPERATIONS)) {
    if (OPERATIONS[name].models.includes(model)) return name;
  }
  throw new Error("unknown operation for " + model);
}

function mimeTypeOf(url, operation) {
  const path = trimmed(url).split("?")[0].toLowerCase();
  if (/\.mp4$/.test(path)) return "video/mp4";
  if (/\.mov$/.test(path)) return "video/quicktime";
  if (/\.zip$/.test(path)) return "application/zip";
  if (/\.wav$/.test(path)) return "audio/wav";
  if (/\.png$/.test(path)) return "image/png";
  if (/\.jpe?g$/.test(path)) return "image/jpeg";
  if (/\.webp$/.test(path)) return "image/webp";
  return operation === "text_to_image" ? "image/png" : "video/mp4";
}

function artifactType(mimeType) {
  if (/^video\//.test(mimeType)) return "video";
  if (/^image\//.test(mimeType)) return "image";
  if (/^audio\//.test(mimeType)) return "audio";
  return "file";
}

// The artifact key of output entry index. Images are image-1, image-2, ...; a
// video task's first output is video and any further one (such as the audio
// track beside a PNG sequence) is output-2, output-3, ...
function artifactKey(index, image) {
  if (image) return "image-" + (index + 1);
  return index === 0 ? "video" : "output-" + (index + 1);
}

// The output index an artifact key names, whichever kind of task it is.
function artifactIndex(key) {
  if (key === "video") return 0;
  const match = /^(?:image|output)-(\d+)$/.exec(trimmed(key));
  return match ? Number(match[1]) - 1 : -1;
}

// The deliverables of a succeeded task.
function artifactEntries(data, operation) {
  const image = operation === "text_to_image";
  return outputURLs(data)
    .map(function (url, index) {
      if (!url) return null;
      const mimeType = mimeTypeOf(url, operation);
      return { key: artifactKey(index, image), type: artifactType(mimeType), mimeType: mimeType, url: url };
    })
    .filter(Boolean);
}

function failureReason(data) {
  const object = plainObject(data) || {};
  const reason = trimmed(object.failure);
  const code = trimmed(object.failureCode);
  if (reason && code) return reason + " (" + code + ")";
  return reason || code || "Runway task failed";
}

function progressOf(data) {
  const value = Number((plainObject(data) || {}).progress);
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(Math.min(value, 1) * 100) + "%";
}

// Runway's task object without its cost details. Output URLs become the
// gateway's download addresses, which do not expire as Runway's do.
function publicTask(data, task, artifacts) {
  const object = plainObject(data) || {};
  const out = { id: task.task_id };
  for (const key of ["createdAt", "status", "progress", "failure", "failureCode"]) {
    if (object[key] !== undefined) out[key] = object[key];
  }
  // The credits Runway charged, which a gateway in front of this one settles on.
  const cost = plainObject(object.cost);
  if (cost && Number(cost.credits) > 0 && Number.isFinite(Number(cost.credits))) out.cost = { credits: Number(cost.credits) };
  if (Array.isArray(object.output)) {
    const links = artifacts || {};
    out.output = object.output.map(function (url, index) {
      const artifact = links[artifactKey(index, true)] || links[artifactKey(index, false)];
      return artifact && trimmed(artifact.url) ? trimmed(artifact.url) : url;
    });
  }
  // The gateway can fail a task Runway still reports as running, after poll
  // failures or the task timeout.
  if (task.status === "FAILURE" && object.status !== "FAILED" && object.status !== "CANCELLED") {
    out.status = "FAILED";
    out.failure = task.fail_reason || "task failed";
    out.failureCode = "gateway_failed";
    delete out.progress;
  }
  return out;
}

function nativeDecoder(operation) {
  return function (ctx) {
    if (!ctx.body || ctx.body.kind !== "json") throw new Error("JSON body required");
    const body = plainObject(ctx.body.value);
    if (!body) throw new Error("request body must be an object");
    const model = trimmed(body.model);
    if (!model) throw new Error("model is required");
    // A channel alias names no Runway model; it is checked again on the
    // mapped model in buildSubmitRequest.
    const checked = MODELS.includes(model) ? model : OPERATIONS[operation].models[0];
    return submitIntent(model, operation, runwayRequest(body, checked, operation));
  };
}

export const native = {
  textToVideo: nativeDecoder("text_to_video"),
  imageToVideo: nativeDecoder("image_to_video"),
  videoToVideo: nativeDecoder("video_to_video"),
  characterPerformance: nativeDecoder("character_performance"),
  textToImage: nativeDecoder("text_to_image"),
  // Runway answers a submission with the task id only.
  taskCreated: function (ctx, task) {
    return { id: task.task_id };
  },
  taskStatus: function (ctx, task) {
    return publicTask(task.data, task, ctx.artifacts);
  },
  error: function (ctx, error) {
    return { error: error.message, code: error.code };
  },
};

export function buildSubmitRequest(ctx) {
  const model = upstreamModel(ctx);
  const operation = operationOf(ctx, model);
  const source = Object.assign({}, plainObject(ctx.requestBody) || {});
  delete source.model;
  const body = withOriginURLs(runwayRequest(source, model, operation), ctx);
  body.model = model;
  return {
    url: apiRoot(ctx) + OPERATIONS[operation].path,
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, taskHeaders(ctx)),
    body: body,
    action: operation,
  };
}

export function parseSubmitResponse(ctx, resp) {
  const body = plainObject(resp.body);
  const id = body ? trimmed(body.id) : "";
  if (!id) throw new Error(viaGateway(ctx) ? "the upstream gateway did not return a task id" : "Runway did not return a task id");
  return { taskId: id, taskData: body };
}

export function extractUsage(ctx) {
  // Legacy per-call prices have no ratio to scale.
  if (ctx.usagePurpose === "billing_ratios") return null;
  const model = upstreamModel(ctx);
  const operation = operationOf(ctx, model);
  const source = Object.assign({}, plainObject(ctx.requestBody) || {});
  delete source.model;
  return { credits: estimatedCredits(runwayRequest(source, model, operation), model) };
}

export function buildQueryRequest(ctx) {
  return {
    url: taskURL(ctx, ctx.taskId),
    method: "GET",
    headers: taskHeaders(ctx),
  };
}

export function parseTaskResult(ctx, body) {
  const data = plainObject(body);
  const status = data ? data.status : undefined;
  if (status === "PENDING" || status === "THROTTLED") return { status: "QUEUED" };
  if (status === "RUNNING") {
    const result = { status: "IN_PROGRESS" };
    const progress = progressOf(data);
    if (progress) result.progress = progress;
    return result;
  }
  if (status === "SUCCEEDED") {
    return outputURLs(data).filter(Boolean).length ? { status: "SUCCESS", progress: "100%" } : { status: "FAILURE", reason: "Runway returned no output" };
  }
  if (status === "FAILED") return { status: "FAILURE", reason: failureReason(data) };
  if (status === "CANCELLED") return { status: "FAILURE", reason: "the task was cancelled or deleted on Runway" };
  return { status: "UNKNOWN", reason: "unrecognized status: " + String(status || "") };
}

// A finished task reports the credits Runway charged in cost.credits. A
// missing or zero count keeps the reserved list price.
export function extractUsageOnComplete(task, result, body) {
  const data = plainObject(body);
  if (!data || data.status !== "SUCCEEDED") return null;
  const cost = plainObject(data.cost);
  const credits = cost ? Number(cost.credits) : NaN;
  if (!(credits > 0) || !Number.isFinite(credits)) return null;
  return { credits: Math.min(credits, MAX_CREDITS) };
}

export function listArtifacts(task) {
  if (task.status !== "SUCCESS") return [];
  return artifactEntries(task.data, task.action).map(function (entry) {
    return { key: entry.key, type: entry.type, mimeType: entry.mimeType };
  });
}

function artifactURL(data, key) {
  const index = artifactIndex(key);
  return index < 0 ? "" : outputURLs(data)[index] || "";
}

// Runway's output URLs expire, so a download asks Runway for fresh ones first
// and falls back to the URL from the last poll.
export function buildContentRequest(ctx) {
  // Through another gateway the file comes from that gateway's task content
  // route, with its token.
  if (viaGateway(ctx)) {
    const id = trimmed(ctx.upstreamTaskId);
    if (!id || artifactIndex(ctx.artifactKey) < 0) throw new Error("artifact_not_found");
    return {
      url: ctx.baseUrl + "/v1/tasks/" + encodeURIComponent(id) + "/artifacts/" + encodeURIComponent(trimmed(ctx.artifactKey)) + "/content",
      method: ctx.clientRequest.method,
      headers: { Authorization: taskHeaders(ctx).Authorization },
    };
  }
  let url = "";
  if (trimmed(ctx.upstreamTaskId)) {
    try {
      const response = utils.fetch({ url: taskURL(ctx, ctx.upstreamTaskId), headers: taskHeaders(ctx) });
      if (response.status === 200) url = artifactURL(response.body, ctx.artifactKey);
    } catch (_error) {
      url = "";
    }
  }
  if (!url) url = artifactURL(ctx.data, ctx.artifactKey);
  if (!url) throw new Error("artifact_not_found");
  return { url: url, method: ctx.clientRequest.method, credentialless: true };
}

function protocolModel(ctx) {
  try {
    return upstreamModel({ upstreamModel: ctx.upstreamModel, model: ctx.model });
  } catch (_error) {
    return "";
  }
}

// Multipart text fields, each given once.
function formFields(body) {
  const req = {};
  const fields = body.fields || {};
  for (const name of Object.keys(fields)) {
    if (fields[name].length > 1) throw new Error(name + " must be provided once");
    req[name] = fields[name][0];
  }
  return req;
}

function uploadedImage(file, name) {
  const mimeType = trimmed(file.mimeType).toLowerCase();
  if (!/^image\//.test(mimeType)) throw new Error(name + " must be an image");
  return { __fileRef: file.ref, encoding: "dataUrl", mimeType: mimeType, maxBytes: MAX_UPLOAD_BYTES };
}

// An OpenAI image given as a URL string, {image_url}, {url} or {task_id}.
function openAIImage(value) {
  const object = plainObject(value);
  if (object && present(object.image_url)) return typeof object.image_url === "string" ? object.image_url : plainObject(object.image_url) ? object.image_url.url : object.image_url;
  if (object && present(object.url) && !present(object.task_id)) return object.url;
  return value;
}

function jsonField(value, name) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    throw new Error(name + " must be a JSON object");
  }
}

// WIDTHxHEIGHT as a Runway ratio, which must be one the model offers.
function sizeRatio(size, ratios) {
  const ratio = trimmed(size).toLowerCase().replace("x", ":").replace("*", ":");
  if (!ratios.includes(ratio)) throw new Error("size must be one of " + ratios.map((item) => item.replace(":", "x")).join(", "));
  return ratio;
}

// The OpenAI video API: prompt, seconds, size and input_reference (the first
// frame), plus Runway's ratio, seed, outputFormat, proresProfile and
// contentModeration. A first frame makes it image to video.
function openAIVideoRequest(req, model) {
  const known = ["model", "prompt", "seconds", "size", "input_reference", "ratio", "duration", "seed", "outputFormat", "proresProfile", "contentModeration", "user"];
  for (const key of Object.keys(req)) {
    if (!known.includes(key)) throw new Error(key + " is not supported");
  }
  const operation = given(req.input_reference) ? "image_to_video" : "text_to_video";
  if (model && !OPERATIONS[operation].models.includes(model)) throw new Error(model + " needs input_reference, the first frame");
  const source = {};
  if (given(req.prompt)) source.promptText = req.prompt;
  if (given(req.input_reference)) source.promptImage = req.input_reference;
  const ratios = operation === "text_to_video" ? TEXT_TO_VIDEO_RATIOS : IMAGE_TO_VIDEO_RATIOS;
  if (given(req.ratio)) source.ratio = req.ratio;
  else if (given(req.size)) source.ratio = sizeRatio(req.size, ratios);
  const seconds = given(req.seconds) ? req.seconds : req.duration;
  if (given(seconds)) source.duration = seconds;
  for (const key of ["seed", "outputFormat", "proresProfile"]) {
    if (given(req[key])) source[key] = req[key];
  }
  if (given(req.contentModeration)) source.contentModeration = jsonField(req.contentModeration, "contentModeration");
  return { operation: operation, body: runwayRequest(source, model || OPERATIONS[operation].models[0], operation) };
}

// The OpenAI Images API: prompt and size, plus Runway's ratio, seed and
// referenceImages. Images sent to /v1/images/edits become reference images.
// Runway returns one image, so n is 1.
function openAIImageRequest(req, images, model) {
  const known = ["model", "prompt", "size", "n", "image", "images", "ratio", "seed", "referenceImages", "contentModeration", "response_format", "user"];
  for (const key of Object.keys(req)) {
    if (!known.includes(key)) throw new Error(key + " is not supported");
  }
  if (given(req.n) && Number(req.n) !== 1) throw new Error("n must be 1; Runway returns one image per request");
  const source = { promptText: req.prompt };
  if (given(req.ratio)) source.ratio = req.ratio;
  else if (given(req.size) && trimmed(req.size).toLowerCase() !== "auto") source.ratio = sizeRatio(req.size, IMAGE_RATIOS);
  if (given(req.seed)) source.seed = req.seed;
  if (given(req.contentModeration)) source.contentModeration = jsonField(req.contentModeration, "contentModeration");
  const refs = images.map((uri) => ({ uri: uri }));
  if (present(req.referenceImages)) {
    const extra = jsonField(req.referenceImages, "referenceImages");
    if (!Array.isArray(extra)) throw new Error("referenceImages must be an array");
    refs.push.apply(refs, extra);
  }
  if (refs.length) source.referenceImages = refs;
  return runwayRequest(source, model || "gen4_image", "text_to_image");
}

export const protocols = {
  openai_video: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      let req;
      if (ctx.body.kind === "json") {
        req = plainObject(ctx.body.value);
        if (!req) throw new Error("JSON object required");
        if (present(req.input_reference)) req = Object.assign({}, req, { input_reference: openAIImage(req.input_reference) });
      } else {
        req = formFields(ctx.body);
        const files = ctx.body.files || [];
        for (const file of files) {
          if (file.field !== "input_reference") throw new Error("unexpected file field: " + file.field);
        }
        if (files.length > 1) throw new Error("input_reference must be provided once");
        if (files.length) req.input_reference = uploadedImage(files[0], "input_reference");
      }
      const request = openAIVideoRequest(req, protocolModel(ctx));
      return submitIntent(ctx.model, request.operation, request.body);
    },
    // The host owns id, status, progress and timestamps.
    render: function (ctx, task) {
      const data = plainObject(task.data) || {};
      const output = { object: "video" };
      if (task.status === "FAILURE") output.error = { code: trimmed(data.failureCode) || "video_generation_failed", message: task.fail_reason || failureReason(data) };
      return output;
    },
  },
  openai_image: {
    decodeRequest: function (ctx) {
      if (!ctx.body || (ctx.body.kind !== "json" && ctx.body.kind !== "multipart")) throw new Error("JSON or multipart body required");
      const operation = ctx.operation === "edit" ? "edit" : "generate";
      let req;
      let images = [];
      if (ctx.body.kind === "json") {
        req = plainObject(ctx.body.value);
        if (!req) throw new Error("JSON object required");
        if (present(req.images)) {
          if (!Array.isArray(req.images)) throw new Error("images must be an array");
          images = req.images.map(openAIImage);
        }
        if (present(req.image)) images = (Array.isArray(req.image) ? req.image : [req.image]).map(openAIImage).concat(images);
      } else {
        req = formFields(ctx.body);
        for (const file of ctx.body.files || []) {
          if (file.field !== "image" && file.field !== "image[]") throw new Error("unexpected file field: " + file.field);
          images.push(uploadedImage(file, "image"));
        }
        if (given(req.image)) images.unshift(req.image);
      }
      if (operation === "generate" && images.length) throw new Error("image is only valid on /v1/images/edits; use referenceImages for reference images");
      if (operation === "edit" && !images.length) throw new Error("image is required");
      return submitIntent(ctx.model, "text_to_image", openAIImageRequest(req, images, protocolModel(ctx)));
    },
    render: function (ctx, task) {
      return {
        data: artifactEntries(task.data, "text_to_image").map(function (entry) {
          return { url: entry.url };
        }),
      };
    },
  },
};

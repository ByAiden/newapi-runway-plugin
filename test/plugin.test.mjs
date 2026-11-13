// Runs the plugin's hooks the way the gateway calls them: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

let fetchImpl = () => {
  throw new Error("utils.fetch is not available");
};
const fetched = [];
globalThis.utils = {
  fetch: (request) => {
    fetched.push(request);
    return fetchImpl(request);
  },
};

const plugin = await import("../plugin.js");
const { meta, native, protocols } = plugin;

const BASE = "https://api.dev.runwayml.com";
const ROUTES = {
  text_to_video: "textToVideo",
  image_to_video: "imageToVideo",
  video_to_video: "videoToVideo",
  character_performance: "characterPerformance",
  text_to_image: "textToImage",
};
const IMG = "https://example.com/frame.jpg";
const VID = "https://example.com/clip.mp4";

function decode(operation, body) {
  return native[ROUTES[operation]]({ method: "POST", path: "/v1/" + operation, params: {}, query: {}, requestHeaders: {}, body: { kind: "json", value: body } });
}

function driver(intent, extra) {
  return Object.assign(
    { requestBody: intent.requestBody, action: intent.action, model: intent.model, upstreamModel: intent.model, baseUrl: BASE, apiKey: "key_test", authHeader: "Bearer key_test", upstream: { kind: "vendor" }, config: {}, files: [], publicTaskId: "task_new" },
    extra || {},
  );
}

function credits(operation, body) {
  return plugin.extractUsage(driver(decode(operation, body))).credits;
}

function protocolCtx(protocol, body, model, extra) {
  return Object.assign({ method: "POST", path: "", params: {}, query: {}, requestHeaders: {}, body: { kind: "json", value: body }, protocol: protocol, operation: "generate", model: model, stream: false }, extra || {});
}

const query = { taskId: "rw-1", publicTaskId: "task_pub", action: "text_to_video", model: "gen4.5", upstreamModel: "gen4.5", baseUrl: BASE, apiKey: "key_test", authHeader: "Bearer key_test", upstream: { kind: "vendor" }, config: {}, data: {}, state: null };
const DONE = { id: "rw-1", createdAt: "2026-11-12T00:00:00Z", status: "SUCCEEDED", output: ["https://cdn.runway.example/out.mp4?sig=1"], cost: { credits: 60 } };

test("manifest follows the community rules", () => {
  assert.equal(meta.apiVersion, 1);
  assert.match(meta.key, /^[a-z0-9]+_runway$/);
  assert.ok(meta.key.length <= 30);
  assert.equal(meta.version, "1.0.0");
  assert.equal(meta.baseUrl, BASE);
  assert.equal(meta.channelTypes, undefined);
  assert.equal(meta.author.url, "https://github.com/" + meta.author.name);
  assert.equal(meta.key, meta.author.name.toLowerCase() + "_runway");
  for (const example of meta.usageExamples) assert.deepEqual(Object.keys(example.facts), Object.keys(meta.usageSchema));
  assert.ok(!JSON.stringify(meta).includes("$"));
  for (const route of meta.routes) assert.ok(!route.path.startsWith("/v1/tasks"), "reserved namespace");
  const declared = new Set(meta.routes.flatMap((route) => route.models || []));
  assert.deepEqual([...declared].sort(), [...meta.models].sort());
});

test("meta is a plain JSON literal the marketplace can read", () => {
  const source = readFileSync(new URL("../plugin.js", import.meta.url), "utf8");
  const start = source.indexOf("export const meta = ");
  const end = source.indexOf("\n};\n", start);
  const literal = source.slice(start + "export const meta = ".length, end + 2).replace(/^\s*\/\/[^\n]*\n/gm, "");
  assert.deepEqual(JSON.parse(literal), JSON.parse(JSON.stringify(meta)));
});

test("usage examples match the reservation of the same request", () => {
  const examples = Object.fromEntries(meta.usageExamples.map((example) => [example.label, example.facts.credits]));
  assert.equal(examples["gen4.5 5s"], credits("text_to_video", { model: "gen4.5", promptText: "x", duration: 5 }));
  assert.equal(examples["gen4.5 10s"], credits("text_to_video", { model: "gen4.5", promptText: "x", duration: 10 }));
  assert.equal(examples["gen4.5 5s hdr10"], credits("text_to_video", { model: "gen4.5", promptText: "x", duration: 5, outputFormat: "hdr10" }));
  assert.equal(examples["gen4_turbo 5s"], credits("image_to_video", { model: "gen4_turbo", promptImage: IMG }));
  assert.equal(examples["gen4_image 1080p"], credits("text_to_image", { model: "gen4_image", promptText: "x" }));
  assert.equal(examples["gen4_image 720p"], credits("text_to_image", { model: "gen4_image", promptText: "x", ratio: "1280:720" }));
  assert.equal(examples["gen4_image_turbo"], credits("text_to_image", { model: "gen4_image_turbo", promptText: "x", referenceImages: [IMG] }));
});

test("gen4.5 text to video sends the version header, defaults and the mapped model", () => {
  const intent = decode("text_to_video", { model: "gen4.5", promptText: " A fox in snow " });
  assert.equal(intent.action, "text_to_video");
  const request = plugin.buildSubmitRequest(driver(intent, { model: "video", upstreamModel: "gen4.5" }));
  assert.equal(request.url, BASE + "/v1/text_to_video");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.Authorization, "Bearer key_test");
  assert.equal(request.headers["X-Runway-Version"], "2024-11-06");
  assert.deepEqual(request.body, { model: "gen4.5", promptText: "A fox in snow", ratio: "1280:720", duration: 5 });
  assert.equal(new URL(request.url).host, new URL(meta.baseUrl).host);
  assert.equal(plugin.extractUsage(driver(intent)).credits, 60);
  assert.equal(plugin.extractUsage(Object.assign(driver(intent), { usagePurpose: "billing_ratios" })), null);
});

test("video prices follow model, duration and output format", () => {
  assert.equal(credits("text_to_video", { model: "gen4.5", promptText: "x", duration: 2 }), 24);
  assert.equal(credits("text_to_video", { model: "gen4.5", promptText: "x", duration: 10, outputFormat: "prores", proresProfile: "422 HQ" }), 170);
  assert.equal(credits("image_to_video", { model: "gen4.5", promptText: "x", promptImage: IMG, duration: 4, outputFormat: "hdr_exr_sequence" }), 128);
  assert.equal(credits("image_to_video", { model: "gen4_turbo", promptImage: IMG, duration: 10 }), 50);
  assert.equal(credits("video_to_video", { model: "aleph2", videoUri: VID, promptText: "make it snow" }), 840);
  assert.equal(credits("video_to_video", { model: "aleph2", videoUri: VID, promptText: "x", outputFormat: "png_sequence" }), 990);
  assert.equal(credits("video_to_video", { model: "aleph2", videoUri: VID, promptText: "x", outputFormat: "sdr_rec709_10bit" }), 2040);
  assert.equal(credits("character_performance", { model: "act_two", character: { type: "image", uri: IMG }, reference: { type: "video", uri: VID } }), 150);
  assert.equal(credits("text_to_image", { model: "gen4_image", promptText: "x", ratio: "1024:1024" }), 8);
  assert.equal(credits("text_to_image", { model: "gen4_image", promptText: "x", ratio: "720:720" }), 5);
});

test("validation rejects what Runway does not take", () => {
  const bad = (operation, body, pattern) => assert.throws(() => decode(operation, body), pattern);
  bad("text_to_video", { model: "gen4.5" }, /promptText is required/);
  bad("text_to_video", { model: "gen4.5", promptText: "x".repeat(1001) }, /at most 1000/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", ratio: "960:960" }, /ratio must be one of 1280:720, 720:1280/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", duration: 11 }, /from 2 to 10/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", duration: 4.5 }, /integer/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", proresProfile: "422" }, /needs outputFormat prores/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", outputFormat: "hdr_prores", proresProfile: "422 LT" }, /proresProfile must be one of 422, 422 HQ, 4444/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", callback_url: "https://a" }, /callback_url is not supported/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", audio: true }, /audio is not supported/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", seed: -1 }, /seed/);
  bad("text_to_video", { model: "gen4.5", promptText: "x", contentModeration: { publicFigureThreshold: "none" } }, /publicFigureThreshold/);
  bad("image_to_video", { model: "gen4.5", promptText: "x" }, /promptImage is required/);
  bad("image_to_video", { model: "gen4_turbo", promptImage: "runway://upload/1" }, /runway:\/\//);
  bad("image_to_video", { model: "gen4_turbo", promptImage: "http://example.com/a.jpg" }, /HTTPS URL or a data URI/);
  bad("image_to_video", { model: "gen4_turbo", promptImage: IMG, outputFormat: "prores" }, /outputFormat is not supported/);
  bad("image_to_video", { model: "gen4_turbo", promptImage: [{ uri: IMG, position: "last" }] }, /position must be first/);
  bad("video_to_video", { model: "aleph2", promptText: "x" }, /videoUri is required/);
  bad("video_to_video", { model: "aleph2", videoUri: VID }, /promptText or keyframes/);
  bad("video_to_video", { model: "aleph2", videoUri: VID, promptText: "x", ratio: "1280:720" }, /targetAspectRatio/);
  bad("video_to_video", { model: "aleph2", videoUri: VID, keyframes: [{ uri: IMG }] }, /exactly one of seconds or at/);
  bad("video_to_video", { model: "aleph2", videoUri: VID, keyframes: [{ uri: IMG, at: 0.1, range: { start_seconds: 0, end_seconds: 2 } }, { uri: IMG, at: 0.5 }] }, /every keyframe sets a range or none/);
  bad("video_to_video", { model: "aleph2", videoUri: VID, keyframes: Array(6).fill({ uri: IMG, at: 0 }) }, /1 to 5/);
  bad("video_to_video", { model: "aleph2", videoUri: VID, promptText: "x", outputFormat: "hdr10" }, /outputFormat must be one of/);
  bad("character_performance", { model: "act_two", character: { type: "image", uri: IMG } }, /reference is required/);
  bad("character_performance", { model: "act_two", character: { type: "audio", uri: IMG }, reference: { type: "video", uri: VID } }, /character.type/);
  bad("character_performance", { model: "act_two", character: { type: "image", uri: IMG }, reference: { type: "video", uri: VID }, expressionIntensity: 6 }, /from 1 to 5/);
  bad("text_to_image", { model: "gen4_image_turbo", promptText: "x" }, /needs 1 to 3 referenceImages/);
  bad("text_to_image", { model: "gen4_image", promptText: "x", referenceImages: [IMG, IMG, IMG, IMG] }, /at most 3/);
  bad("text_to_image", { model: "gen4_image", promptText: "x", referenceImages: [{ uri: IMG, tag: "1bad" }] }, /tag must be/);
  bad("text_to_image", { model: "gen4_image", promptText: "x", ratio: "4096:4096" }, /ratio must be one of/);
  bad("text_to_image", { model: "gen4_image", promptText: "x", referenceImages: [{ file_id: "f" }] }, /HTTPS URL, a data URI or \{task_id\}/);
});

test("a model on the wrong endpoint is rejected, including a mapped one", () => {
  assert.throws(() => decode("text_to_video", { model: "gen4_turbo", promptText: "x" }), /does not serve \/v1\/text_to_video/);
  const alias = decode("text_to_video", { model: "fast-video", promptText: "x" });
  assert.throws(() => plugin.buildSubmitRequest(driver(alias, { upstreamModel: "gen4_turbo" })), /gen4_turbo does not serve/);
  assert.throws(() => plugin.buildSubmitRequest(driver(alias, { upstreamModel: "gen3a_turbo" })), /not a supported Runway model/);
});

test("image to video, Aleph and Act-Two bodies pass through whitelisted fields", () => {
  const i2v = decode("image_to_video", { model: "gen4.5", promptText: "x", promptImage: [{ uri: IMG, position: "first" }], ratio: "960:960", duration: "8", seed: 7, contentModeration: { publicFigureThreshold: "low" } });
  assert.deepEqual(plugin.buildSubmitRequest(driver(i2v)).body, { model: "gen4.5", promptText: "x", promptImage: [{ uri: IMG, position: "first" }], ratio: "960:960", duration: 8, seed: 7, contentModeration: { publicFigureThreshold: "low" } });
  const aleph = decode("video_to_video", { model: "aleph2", videoUri: VID, keyframes: [{ uri: IMG, seconds: 1.5, range: { start_seconds: 1, end_seconds: 3 } }], targetAspectRatio: "9:16", outputFormat: "prores" });
  const alephRequest = plugin.buildSubmitRequest(driver(aleph));
  assert.equal(alephRequest.url, BASE + "/v1/video_to_video");
  assert.deepEqual(alephRequest.body, { model: "aleph2", videoUri: VID, keyframes: [{ uri: IMG, seconds: 1.5, range: { start_seconds: 1, end_seconds: 3 } }], targetAspectRatio: "9:16", outputFormat: "prores" });
  const act = decode("character_performance", { model: "act_two", character: { type: "video", uri: VID }, reference: { type: "video", uri: VID }, bodyControl: true, expressionIntensity: 4, ratio: "1280:720" });
  const actRequest = plugin.buildSubmitRequest(driver(act));
  assert.equal(actRequest.url, BASE + "/v1/character_performance");
  assert.deepEqual(actRequest.body, { model: "act_two", character: { type: "video", uri: VID }, reference: { type: "video", uri: VID }, bodyControl: true, expressionIntensity: 4, ratio: "1280:720" });
  const image = decode("text_to_image", { model: "gen4_image", promptText: "@cat on a mat", referenceImages: [{ uri: IMG, tag: "cat" }, "data:image/png;base64,aGk="] });
  assert.deepEqual(plugin.buildSubmitRequest(driver(image)).body.referenceImages, [{ uri: IMG, tag: "cat" }, { uri: "data:image/png;base64,aGk=" }]);
});

test("an earlier gateway task becomes a fresh Runway output URL", () => {
  fetched.length = 0;
  fetchImpl = (request) => {
    assert.equal(request.headers["X-Runway-Version"], "2024-11-06");
    return { status: 200, headers: {}, body: { id: "rw-old", status: "SUCCEEDED", output: ["https://cdn.runway.example/fresh.mp4"] } };
  };
  const intent = decode("video_to_video", { model: "aleph2", videoUri: { task_id: "task_old" }, promptText: "add rain" });
  assert.deepEqual(intent.originTaskIds, ["task_old"]);
  const origin = [{ taskId: "task_old", upstreamTaskId: "rw-old", action: "text_to_video", status: "SUCCESS", data: { status: "SUCCEEDED", output: ["https://cdn.runway.example/stale.mp4"] } }];
  const request = plugin.buildSubmitRequest(driver(intent, { originTasks: origin }));
  assert.equal(request.body.videoUri, "https://cdn.runway.example/fresh.mp4");
  assert.equal(fetched[0].url, BASE + "/v1/tasks/rw-old");
  assert.deepEqual(intent.requestBody.videoUri, { task_id: "task_old" });
  fetchImpl = () => ({ status: 500, headers: {}, body: "" });
  assert.equal(plugin.buildSubmitRequest(driver(intent, { originTasks: origin })).body.videoUri, "https://cdn.runway.example/stale.mp4");
  assert.throws(() => plugin.buildSubmitRequest(driver(intent, { originTasks: [] })), /task task_old is not available/);
  const image = decode("text_to_image", { model: "gen4_image_turbo", promptText: "x", referenceImages: [{ uri: { task_id: "task_old", output_index: 1 } }] });
  assert.throws(() => plugin.buildSubmitRequest(driver(image, { originTasks: origin })), /has no output 1/);
});

test("hooks do not mutate their arguments", () => {
  const intent = decode("image_to_video", { model: "gen4.5", promptText: "x", promptImage: { task_id: "task_old" } });
  const ctx = driver(intent, { originTasks: [{ taskId: "task_old", upstreamTaskId: "rw-old", action: "text_to_image", status: "SUCCESS", data: { status: "SUCCEEDED", output: [IMG] } }] });
  const before = JSON.stringify(ctx);
  fetchImpl = () => ({ status: 404, headers: {}, body: {} });
  plugin.buildSubmitRequest(ctx);
  plugin.extractUsage(ctx);
  assert.equal(JSON.stringify(ctx), before);
});

test("submit keeps the Runway task id", () => {
  assert.deepEqual(plugin.parseSubmitResponse({}, { statusCode: 200, headers: {}, body: { id: "rw-1" } }), { taskId: "rw-1", taskData: { id: "rw-1" } });
  assert.throws(() => plugin.parseSubmitResponse({}, { statusCode: 200, headers: {}, body: {} }), /did not return a task id/);
});

test("polling maps every Runway status", () => {
  const request = plugin.buildQueryRequest(query);
  assert.equal(request.url, BASE + "/v1/tasks/rw-1");
  assert.equal(request.headers["X-Runway-Version"], "2024-11-06");
  const parse = (body) => plugin.parseTaskResult(query, body, { status: 200, headers: {} });
  assert.deepEqual(parse({ status: "PENDING", estimatedCost: { credits: 60 } }), { status: "QUEUED" });
  assert.deepEqual(parse({ status: "THROTTLED" }), { status: "QUEUED" });
  assert.deepEqual(parse({ status: "RUNNING", progress: 0.42 }), { status: "IN_PROGRESS", progress: "42%" });
  assert.deepEqual(parse(DONE), { status: "SUCCESS", progress: "100%" });
  assert.equal(parse({ status: "SUCCEEDED", output: [] }).status, "FAILURE");
  assert.deepEqual(parse({ status: "FAILED", failure: "Content moderated", failureCode: "SAFETY.INPUT.TEXT", cost: { credits: 60 } }), { status: "FAILURE", reason: "Content moderated (SAFETY.INPUT.TEXT)" });
  assert.equal(parse({ status: "CANCELLED" }).status, "FAILURE");
  assert.equal(parse({ status: "TELEPORTING" }).status, "UNKNOWN");
  assert.equal(parse(null).status, "UNKNOWN");
});

test("completion settles on cost.credits", () => {
  assert.deepEqual(plugin.extractUsageOnComplete({}, {}, DONE), { credits: 60 });
  assert.deepEqual(plugin.extractUsageOnComplete({}, {}, Object.assign({}, DONE, { cost: { credits: 9999 } })), { credits: 2040 });
  assert.equal(plugin.extractUsageOnComplete({}, {}, Object.assign({}, DONE, { cost: { credits: 0 } })), null);
  assert.equal(plugin.extractUsageOnComplete({}, {}, Object.assign({}, DONE, { cost: undefined })), null);
  assert.equal(plugin.extractUsageOnComplete({}, {}, { status: "FAILED", cost: { credits: 60 } }), null);
});

test("artifacts, downloads and the native presenters", () => {
  const multi = { id: "rw-2", status: "SUCCEEDED", output: ["https://cdn.runway.example/frames.zip", "https://cdn.runway.example/audio.wav"], cost: { credits: 85 } };
  assert.deepEqual(plugin.listArtifacts({ taskId: "rw-1", status: "SUCCESS", action: "text_to_video", data: DONE }), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  assert.deepEqual(plugin.listArtifacts({ taskId: "rw-2", status: "SUCCESS", action: "text_to_video", data: multi }), [
    { key: "video", type: "file", mimeType: "application/zip" },
    { key: "output-2", type: "audio", mimeType: "audio/wav" },
  ]);
  const image = { status: "SUCCEEDED", output: ["https://cdn.runway.example/a.png"] };
  assert.deepEqual(plugin.listArtifacts({ status: "SUCCESS", action: "text_to_image", data: image }), [{ key: "image-1", type: "image", mimeType: "image/png" }]);
  assert.deepEqual(plugin.listArtifacts({ status: "FAILURE", action: "text_to_video", data: DONE }), []);

  fetchImpl = () => ({ status: 200, headers: {}, body: Object.assign({}, DONE, { output: ["https://cdn.runway.example/fresh.mp4"] }) });
  const content = Object.assign({}, query, { artifactKey: "video", data: DONE, upstreamTaskId: "rw-1", clientRequest: { method: "GET", headers: {} } });
  assert.deepEqual(plugin.buildContentRequest(content), { url: "https://cdn.runway.example/fresh.mp4", method: "GET", credentialless: true });
  fetchImpl = () => {
    throw new Error("down");
  };
  assert.equal(plugin.buildContentRequest(content).url, DONE.output[0]);
  assert.throws(() => plugin.buildContentRequest(Object.assign({}, content, { artifactKey: "output-3" })), /artifact_not_found/);

  assert.deepEqual(native.taskCreated({}, { task_id: "task_pub", data: { id: "rw-1" } }), { id: "task_pub" });
  const shown = native.taskStatus({ artifacts: { video: { key: "video", type: "video", url: "https://gw.example/content/1" } } }, { task_id: "task_pub", status: "SUCCESS", data: DONE });
  assert.deepEqual(shown, { id: "task_pub", createdAt: DONE.createdAt, status: "SUCCEEDED", output: ["https://gw.example/content/1"] });
  const imageShown = native.taskStatus({ artifacts: { "image-1": { url: "https://gw.example/content/2" } } }, { task_id: "task_pub", status: "SUCCESS", data: image });
  assert.deepEqual(imageShown.output, ["https://gw.example/content/2"]);
  const failed = native.taskStatus({ artifacts: {} }, { task_id: "task_pub", status: "FAILURE", fail_reason: "poll timeout", data: { id: "rw-1", status: "RUNNING", progress: 0.5 } });
  assert.deepEqual(failed, { id: "task_pub", status: "FAILED", failure: "poll timeout", failureCode: "gateway_failed" });
});

test("OpenAI video API maps to Gen-4.5 and Gen-4 Turbo", () => {
  const t2v = protocols.openai_video.decodeRequest(protocolCtx("openai_video", { model: "gen4.5", prompt: "A boat", seconds: "8", size: "720x1280" }, "gen4.5"));
  assert.equal(t2v.action, "text_to_video");
  assert.deepEqual(plugin.buildSubmitRequest(driver(t2v)).body, { model: "gen4.5", promptText: "A boat", ratio: "720:1280", duration: 8 });
  assert.equal(plugin.extractUsage(driver(t2v)).credits, 96);
  const i2v = protocols.openai_video.decodeRequest(protocolCtx("openai_video", { prompt: "A boat", input_reference: { image_url: IMG }, size: "1584x672" }, "gen4_turbo"));
  assert.equal(i2v.action, "image_to_video");
  assert.equal(plugin.buildSubmitRequest(driver(i2v)).url, BASE + "/v1/image_to_video");
  const multipart = protocols.openai_video.decodeRequest(
    protocolCtx("openai_video", null, "gen4.5", { body: { kind: "multipart", fields: { prompt: ["x"], seconds: ["4"] }, files: [{ ref: "request_file:input_reference", field: "input_reference", filename: "a.png", mimeType: "image/PNG", size: 10 }] } }),
  );
  assert.deepEqual(multipart.requestBody.promptImage, { __fileRef: "request_file:input_reference", encoding: "dataUrl", mimeType: "image/png", maxBytes: 3750000 });
  assert.throws(() => protocols.openai_video.decodeRequest(protocolCtx("openai_video", { prompt: "x" }, "gen4_turbo")), /needs input_reference/);
  assert.throws(() => protocols.openai_video.decodeRequest(protocolCtx("openai_video", { prompt: "x", size: "1920x1080" }, "gen4.5")), /size must be one of 1280x720, 720x1280/);
  assert.throws(() => protocols.openai_video.decodeRequest(protocolCtx("openai_video", { prompt: "x", watermark: true }, "gen4.5")), /watermark is not supported/);
  assert.deepEqual(protocols.openai_video.render({}, { status: "SUCCESS", data: DONE }), { object: "video" });
  assert.deepEqual(protocols.openai_video.render({}, { status: "FAILURE", fail_reason: "Content moderated", data: { status: "FAILED", failureCode: "SAFETY" } }), { object: "video", error: { code: "SAFETY", message: "Content moderated" } });
});

test("OpenAI Images API maps to Gen-4 Image", () => {
  const gen = protocols.openai_image.decodeRequest(protocolCtx("openai_image", { model: "gen4_image", prompt: "A cat", size: "1080x1440", n: 1, response_format: "b64_json" }, "gen4_image"));
  assert.equal(gen.action, "text_to_image");
  assert.deepEqual(plugin.buildSubmitRequest(driver(gen)).body, { model: "gen4_image", promptText: "A cat", ratio: "1080:1440" });
  const edit = protocols.openai_image.decodeRequest(
    protocolCtx("openai_image", null, "gen4_image_turbo", {
      operation: "edit",
      body: { kind: "multipart", fields: { prompt: ["@ref as a sketch"], referenceImages: ['[{"uri":"https://example.com/b.jpg","tag":"ref"}]'] }, files: [{ ref: "request_file:image", field: "image", filename: "a.jpg", mimeType: "image/jpeg", size: 9 }] },
    }),
  );
  assert.deepEqual(edit.requestBody.referenceImages, [{ uri: { __fileRef: "request_file:image", encoding: "dataUrl", mimeType: "image/jpeg", maxBytes: 3750000 } }, { uri: "https://example.com/b.jpg", tag: "ref" }]);
  assert.equal(plugin.extractUsage(driver(edit)).credits, 2);
  assert.throws(() => protocols.openai_image.decodeRequest(protocolCtx("openai_image", { prompt: "x", n: 2 }, "gen4_image")), /n must be 1/);
  assert.throws(() => protocols.openai_image.decodeRequest(protocolCtx("openai_image", { prompt: "x", image: IMG }, "gen4_image")), /only valid on \/v1\/images\/edits/);
  assert.throws(() => protocols.openai_image.decodeRequest(protocolCtx("openai_image", { prompt: "x" }, "gen4_image_turbo")), /needs 1 to 3 referenceImages/);
  assert.deepEqual(protocols.openai_image.render({}, { status: "SUCCESS", data: { status: "SUCCEEDED", output: ["https://cdn.runway.example/a.png"] } }), { data: [{ url: "https://cdn.runway.example/a.png" }] });
});

// The plugin on a New API channel (type 60): the same plugin answers on
// another gateway. node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fetched = [];
globalThis.utils = {
  fetch: (request) => {
    fetched.push(request);
    throw new Error("no fetch on a New API channel");
  },
};

const plugin = await import("../plugin.js");
const { meta, native, protocols } = plugin;
const source = readFileSync(new URL("../plugin.js", import.meta.url), "utf8");

const GATEWAY = "https://middle.example.com";
const KEY = meta.key;
const TOKEN = "sk-middle";
const UPSTREAM = { kind: "new_api" };
const ROUTES = { text_to_video: "textToVideo", image_to_video: "imageToVideo", video_to_video: "videoToVideo", character_performance: "characterPerformance", text_to_image: "textToImage" };

function decode(operation, body) {
  return native[ROUTES[operation]]({ method: "POST", path: "/v1/" + operation, params: {}, query: {}, requestHeaders: {}, body: { kind: "json", value: body } });
}

function driver(intent, extra) {
  return Object.assign(
    { requestBody: intent.requestBody, action: intent.action, model: intent.model, upstreamModel: intent.model, baseUrl: GATEWAY, apiKey: TOKEN, authHeader: "Bearer " + TOKEN, upstream: UPSTREAM, config: {}, files: [], publicTaskId: "task_outer" },
    extra || {},
  );
}

const query = { taskId: "task_middle", publicTaskId: "task_outer", action: "text_to_video", model: "gen4.5", upstreamModel: "gen4.5", baseUrl: GATEWAY, apiKey: TOKEN, authHeader: "Bearer " + TOKEN, upstream: UPSTREAM, config: {}, data: {}, state: null };

function artifactURL(key) {
  return GATEWAY + "/v1/tasks/task_middle/artifacts/" + key + "/content?access=sig";
}

// What the middle gateway's own task presenter renders.
const MIDDLE_DONE = { id: "task_middle", createdAt: "2026-11-12T00:00:00Z", status: "SUCCEEDED", output: [artifactURL("video")], cost: { credits: 48 } };

test("meta declares the New API upstream and PLUGIN_KEY matches meta.key", () => {
  assert.deepEqual(meta.upstreams, ["vendor", "new_api"]);
  assert.equal(/const PLUGIN_KEY = "([^"]+)";/.exec(source)[1], KEY);
});

test("the version matches both CHANGELOGs", () => {
  for (const file of ["CHANGELOG.md", "CHANGELOG.zh-CN.md"]) {
    const text = readFileSync(new URL("../" + file, import.meta.url), "utf8");
    assert.equal(/\nversion: "?([0-9.]+)"?\n/.exec(text)[1], meta.version, file);
    assert.equal((text.match(/^## \[/gm) || []).length, 1, file);
  }
});

test("submissions go to the gateway's routes under the plugin key with its token only", () => {
  for (const [operation, body] of [
    ["text_to_video", { model: "gen4.5", promptText: "a dog", ratio: "1280:720", duration: 5 }],
    ["text_to_image", { model: "gen4_image", promptText: "a cat", ratio: "1920:1080" }],
  ]) {
    const request = plugin.buildSubmitRequest(driver(decode(operation, body)));
    assert.equal(request.url, GATEWAY + "/" + KEY + "/v1/" + operation);
    assert.deepEqual(request.headers, { "Content-Type": "application/json", Accept: "application/json", Authorization: "Bearer " + TOKEN });
  }
  assert.equal(fetched.length, 0);
});

test("{task_id} references are passed on as the gateway's task ids", () => {
  const intent = decode("image_to_video", { model: "gen4.5", promptText: "move", promptImage: { task_id: "task_outer_img" }, ratio: "1280:720" });
  assert.deepEqual(intent.originTaskIds, ["task_outer_img"]);
  const origin = [{ taskId: "task_outer_img", upstreamTaskId: "task_middle_img", action: "text_to_image", data: { status: "SUCCEEDED", output: [artifactURL("image-1")] } }];
  const request = plugin.buildSubmitRequest(driver(intent, { originTasks: origin }));
  assert.deepEqual(request.body.promptImage, { task_id: "task_middle_img" });
  const indexed = decode("video_to_video", { model: "aleph2", promptText: "x", videoUri: { task_id: "task_outer_img", output_index: 0 } });
  const swapped = plugin.buildSubmitRequest(driver(indexed, { originTasks: origin }));
  assert.deepEqual(swapped.body.videoUri, { task_id: "task_middle_img", output_index: 0 });
  assert.throws(() => plugin.buildSubmitRequest(driver(intent, { originTasks: [] })), /not available/);
  assert.equal(fetched.length, 0);
});

test("the gateway's submit reply carries its task id", () => {
  assert.deepEqual(plugin.parseSubmitResponse(driver(decode("text_to_image", { model: "gen4_image", promptText: "a" })), { status: 200, body: { id: "task_middle" } }), { taskId: "task_middle", taskData: { id: "task_middle" } });
  assert.throws(() => plugin.parseSubmitResponse(driver({ model: "gen4_image", requestBody: {} }), { status: 400, body: { error: "bad", code: "invalid_request" } }), /upstream gateway/);
});

test("polling uses the gateway's /runway/v1/tasks route", () => {
  const request = plugin.buildQueryRequest(query);
  assert.equal(request.url, GATEWAY + "/" + KEY + "/runway/v1/tasks/task_middle");
  assert.deepEqual(request.headers, { Accept: "application/json", Authorization: "Bearer " + TOKEN });
});

test("the gateway's task presenter maps to the host states and settles on cost.credits", () => {
  assert.deepEqual(plugin.parseTaskResult(query, MIDDLE_DONE), { status: "SUCCESS", progress: "100%" });
  assert.deepEqual(plugin.parseTaskResult(query, { id: "task_middle", status: "RUNNING", progress: 0.4 }), { status: "IN_PROGRESS", progress: "40%" });
  assert.deepEqual(plugin.parseTaskResult(query, { id: "task_middle", status: "FAILED", failure: "timeout", failureCode: "gateway_failed" }), { status: "FAILURE", reason: "timeout (gateway_failed)" });
  assert.deepEqual(plugin.extractUsageOnComplete(query, { status: "SUCCESS" }, MIDDLE_DONE), { credits: 48 });
  const intent = decode("text_to_video", { model: "gen4.5", promptText: "a", duration: 8 });
  assert.deepEqual(plugin.extractUsage(driver(intent)), plugin.extractUsage(driver(intent, { upstream: { kind: "vendor" } })));
});

test("the native task presenter passes on the credits Runway charged", () => {
  const vendor = { id: "rw-1", status: "SUCCEEDED", output: ["https://cdn.runway.example/out.mp4"], cost: { credits: 60, breakdown: { secret: 1 } } };
  const out = native.taskStatus({ artifacts: { video: { url: artifactURL("video") } } }, { task_id: "task_pub", status: "SUCCESS", data: vendor });
  assert.deepEqual(out.cost, { credits: 60 });
  assert.deepEqual(out.output, [artifactURL("video")]);
  const running = native.taskStatus({}, { task_id: "task_pub", status: "IN_PROGRESS", data: { id: "rw-1", status: "RUNNING" } });
  assert.equal(running.cost, undefined);
});

test("downloads come from the gateway's task content route with its token", () => {
  const task = { status: "SUCCESS", action: "text_to_video", data: MIDDLE_DONE };
  assert.deepEqual(plugin.listArtifacts(task), [{ key: "video", type: "video", mimeType: "video/mp4" }]);
  const ctx = Object.assign({}, query, { data: MIDDLE_DONE, artifactKey: "video", upstreamTaskId: "task_middle", clientRequest: { method: "GET", headers: {} } });
  assert.deepEqual(plugin.buildContentRequest(ctx), { url: GATEWAY + "/v1/tasks/task_middle/artifacts/video/content", method: "GET", headers: { Authorization: "Bearer " + TOKEN } });
  assert.throws(() => plugin.buildContentRequest(Object.assign({}, ctx, { artifactKey: "../x" })), /artifact_not_found/);
  assert.equal(fetched.length, 0);
});

test("the OpenAI image render returns the gateway's file addresses", () => {
  const data = { id: "task_middle", status: "SUCCEEDED", output: [artifactURL("image-1")] };
  assert.deepEqual(protocols.openai_image.render({ model: "gen4_image" }, { status: "SUCCESS", data: data }), { data: [{ url: artifactURL("image-1") }] });
});

test("a context without upstream keeps the vendor behaviour", () => {
  const request = plugin.buildSubmitRequest(driver(decode("text_to_video", { model: "gen4.5", promptText: "a" }), { upstream: undefined, baseUrl: "https://api.dev.runwayml.com" }));
  assert.equal(request.url, "https://api.dev.runwayml.com/v1/text_to_video");
  assert.equal(request.headers["X-Runway-Version"], "2024-11-06");
  assert.equal(plugin.buildQueryRequest(Object.assign({}, query, { upstream: undefined, baseUrl: "https://api.dev.runwayml.com" })).url, "https://api.dev.runwayml.com/v1/tasks/task_middle");
});

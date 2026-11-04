import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  PAUSED,
  DISCORD_URL,
  HUB_URL,
  STALE_MS,
  esc,
  resolveSource,
  summarizeFeed,
  statusLine,
  houseCard,
  houseDetail,
  historyBlock,
  countsLine
} from "../src/bridge.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const NOW = Date.parse("2026-11-04T12:00:00Z");

test("the bridge is paused and keeps the public doors", () => {
  assert.equal(PAUSED, true);
  assert.equal(DISCORD_URL, "https://discord.gg/YCam2NEkv9");
  assert.equal(HUB_URL, "https://jpavia10.github.io/prometheus-hub/");
  assert.equal(STALE_MS, 45 * 60 * 1000);
});

test("source resolution stays on local files unless a saved feed names https", () => {
  assert.equal(resolveSource({ file: "fleet-sebastian.json" }), "data/fleet-sebastian.json");
  assert.equal(resolveSource({ file: "../secret.json" }), null);
  assert.equal(resolveSource({ file: "data/fleet-sebastian.json" }), null);
  assert.equal(resolveSource({ url: "http://example.com/feed.json" }), null);
  assert.equal(resolveSource({ url: "https://example.com/feed.json" }), "https://example.com/feed.json");
  assert.equal(resolveSource({ fileId: "abc" }), null);
  assert.equal(
    resolveSource({ fileId: "abcdefghijklmnop" }),
    "https://drive.google.com/uc?export=download&id=abcdefghijklmnop"
  );
});

test("a real feed is held, even when the timestamp is fresh", () => {
  const feed = JSON.parse(read("data/fleet-sebastian.json"));
  const fresh = summarizeFeed({ ai: "sebastian", label: "Sebastian · Muse", file: "fleet-sebastian.json" }, { ok: true, feed }, Date.parse(feed.updated_at) + 1000);
  assert.equal(fresh.signal, "held");
  assert.equal(fresh.stale, false);
  assert.equal(fresh.reported, true);
  assert.equal(fresh.specialists.length, 6);
  assert.equal(fresh.scheduled.length, 32);
  assert.equal(fresh.chats.length, 6);
  assert.equal(fresh.recordedLive.length, 1);

  const held = summarizeFeed({ ai: "sebastian" }, { ok: true, feed }, NOW);
  assert.equal(held.signal, "held");
  assert.equal(held.stale, true);
  assert.match(countsLine(held), /6 specialists/);
  assert.match(countsLine(held), /32 scheduled jobs/);
  const card = houseCard(held, 0);
  assert.match(card, /Sebastian/);
  assert.match(card, /Held/);
  assert.doesNotMatch(card, /LIVE|live watch|on duty/i);
  const detail = houseDetail(held);
  assert.match(detail, /Older than 45 minutes/);
  assert.match(detail, /Captain/);
  assert.match(detail, /deterministic-doctor/);
  assert.match(detail, /Photo Cleanup/);
  assert.match(detail, /paused/i);
  assert.doesNotMatch(detail, /<script/i);
});

test("placeholder files stay awaiting and a failed read stays silent", () => {
  const feed = JSON.parse(read("data/fleet-chatgpt.json"));
  const waiting = summarizeFeed({ ai: "chatgpt", label: "ChatGPT" }, { ok: true, feed }, NOW);
  assert.equal(waiting.signal, "awaiting");
  assert.equal(waiting.specialists.length, 0);
  assert.match(houseCard(waiting, 1), /Awaiting/);
  assert.match(countsLine(waiting), /Placeholder/);

  const silent = summarizeFeed({ ai: "grok", label: "Grok" }, { ok: false, err: "HTTP 404" }, NOW);
  assert.equal(silent.signal, "no-signal");
  assert.match(houseDetail(silent), /HTTP 404/);
});

test("markup escapes feed text", () => {
  assert.equal(esc(`<img src=x onerror=alert(1)>"'`), "&lt;img src=x onerror=alert(1)&gt;&quot;&#39;");
  const nasty = summarizeFeed({ ai: "x", label: "<b>no</b>" }, {
    ok: true,
    feed: {
      ai: "x",
      label: "<b>no</b>",
      updated_at: "2026-10-01T00:00:00Z",
      specialists: [{ name: "<script>", specialty: "x", status: "standby" }]
    }
  }, NOW);
  assert.match(houseCard(nasty, 0), /&lt;b&gt;no&lt;\/b&gt;/);
  assert.match(houseDetail(nasty), /&lt;script&gt;/);
  assert.doesNotMatch(houseDetail(nasty), /<script>/);
});

test("status line and history stay descriptive", () => {
  const houses = [
    { signal: "held" },
    { signal: "awaiting" },
    { signal: "awaiting" },
    { signal: "no-signal" }
  ];
  const line = statusLine(houses, "2026-10-16T17:26:00Z");
  assert.match(line, /^Paused\./);
  assert.match(line, /4 houses/);
  assert.match(line, /1 held report/);
  assert.match(line, /Nothing is polled/);
  const history = JSON.parse(read("data/history.json"));
  const block = historyBlock(history);
  assert.match(block, /sebastian/);
  assert.match(block, /rollup/);
  assert.equal(historyBlock(null), "");
});

test("the page and workflows do not poll or brand another house", () => {
  const page = read("index.html");
  const main = read("src/main.js");
  const particles = read("src/particles.js");
  const sw = read("sw.js");
  const sync = read(".github/workflows/sync-fleet.yml");
  const history = read(".github/workflows/sync-fleet-history.yml");
  for (const source of [page, main, particles, sw, sync, history]) {
    assert.doesNotMatch(source, /Sylade/i);
    assert.doesNotMatch(source, /setInterval|setTimeout/);
  }
  assert.match(page, /Paused/);
  assert.match(page, /Fleet Command/);
  assert.match(page, /fleet\.js/);
  assert.match(page, new RegExp(DISCORD_URL.replace(/[.]/g, "\\.")));
  assert.match(page, /prometheus-hub/);
  assert.doesNotMatch(page, /BRIDGE \/\/ LIVE|RED ALERT|cache:'no-store'/);
  assert.doesNotMatch(sync, /cron:/);
  assert.doesNotMatch(history, /cron:/);
  assert.match(sync, /workflow_dispatch/);
  assert.match(history, /workflow_dispatch/);
  assert.match(sw, /No background sync/);
  assert.match(particles, /visibilitychange/);
});

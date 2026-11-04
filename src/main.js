/* Fleet Command shell. One read of the saved report, then idle.
   Do not add a timer, a refresh loop, or a background sync. */
import { startField, focusField, releaseField } from "./particles.js";
import {
  summarizeFeed,
  resolveSource,
  statusLine,
  housesMarkup,
  houseDetail,
  historyBlock
} from "./bridge.js";

const canvas = document.getElementById("field");
if (canvas) {
  try {
    startField(canvas);
    document.documentElement.classList.add("has-gl");
  } catch (error) {
    document.documentElement.classList.add("no-gl");
    console.warn("Particle field unavailable", error);
  }
}

const statusMeta = document.getElementById("status-meta");
const statusNote = document.getElementById("status-note");
const houseStack = document.getElementById("houses-stack");
const historyRoot = document.getElementById("history");
const reread = document.getElementById("reread");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");

let houses = [];
let lastFocus = null;
let reading = false;

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();
  if (!data || typeof data !== "object") throw new Error("bad json");
  return data;
}

async function loadHistory() {
  try {
    const history = await readJson("data/history.json");
    if (historyRoot) historyRoot.innerHTML = historyBlock(history);
  } catch (error) {
    if (historyRoot) historyRoot.innerHTML = "";
  }
}

async function loadBridge() {
  if (reading) return;
  reading = true;
  if (reread) reread.hidden = true;
  try {
    const registry = await readJson("data/registry.json");
    const metas = Array.isArray(registry.feeds) ? registry.feeds : [];
    const now = Date.now();
    houses = await Promise.all(metas.map(async (meta) => {
      const url = resolveSource(meta);
      if (!url) return summarizeFeed(meta, { ok: false, err: "no source" }, now);
      try {
        const feed = await readJson(url);
        return summarizeFeed(meta, { ok: true, feed }, now);
      } catch (error) {
        return summarizeFeed(meta, { ok: false, err: String((error && error.message) || error) }, now);
      }
    }));
    if (statusMeta) {
      const full = statusLine(houses, registry.updated_at || null).replace(/^Paused\.\s*/, "");
      const splitAt = full.indexOf(". Registry ");
      if (splitAt === -1) {
        statusMeta.textContent = full;
        if (statusNote) statusNote.textContent = "";
      } else {
        statusMeta.textContent = full.slice(0, splitAt + 1);
        if (statusNote) statusNote.textContent = full.slice(splitAt + 2);
      }
    }
    if (houseStack) houseStack.innerHTML = housesMarkup(houses);
  } catch (error) {
    houses = [];
    if (statusMeta) {
      statusMeta.textContent = "The registry file did not open.";
    }
    if (statusNote) statusNote.textContent = "Nothing will retry on its own.";
    if (houseStack) houseStack.innerHTML = `<p class="meta">Saved report unavailable.</p>`;
    if (reread) reread.hidden = false;
  } finally {
    reading = false;
  }
}

function openHouse(index) {
  const house = houses[index];
  if (!house || !detail || !detailBody) return;
  lastFocus = document.activeElement;
  detailBody.innerHTML = houseDetail(house);
  detail.hidden = false;
  document.body.classList.add("is-detail");
  focusField({ scroll: 0.48, pull: 0.1, scale: 1.08, z: 3.5, shift: 0.15 });
  const back = detail.querySelector(".detail-back");
  if (back) back.focus();
}

function closeDetail() {
  if (!detail || detail.hidden) return;
  detail.hidden = true;
  document.body.classList.remove("is-detail");
  releaseField();
  if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
}

if (houseStack) {
  houseStack.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-i]");
    if (!button || !houseStack.contains(button)) return;
    openHouse(Number(button.getAttribute("data-i")));
  });
}

if (detail) {
  detail.addEventListener("click", (event) => {
    if (event.target.closest("[data-close]")) closeDetail();
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeDetail();
});

if (reread) reread.addEventListener("click", () => { loadBridge(); });

loadBridge();
loadHistory();

if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  });
}

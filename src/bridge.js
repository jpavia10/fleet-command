/* Fleet Command report. Pure: one snapshot in, held markup out.
   The page is paused. A feed is never classified as live. */

export const PAUSED = true;
export const STALE_MS = 45 * 60 * 1000;
export const HUB_URL = "https://jpavia10.github.io/prometheus-hub/";
export const DISCORD_URL = "https://discord.gg/YCam2NEkv9";

const BAD = new Set(["error", "failed", "stopped"]);
const OK = new Set(["ok", "done"]);

export function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

export function formatWhen(iso) {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return "—";
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, "0");
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate())
    + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) + " UTC";
}

export function resolveSource(meta) {
  if (!meta || typeof meta !== "object") return null;
  if (typeof meta.file === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.json$/.test(meta.file)) {
    return "data/" + meta.file;
  }
  if (typeof meta.url === "string" && /^https:\/\/[^\s]+$/.test(meta.url)) return meta.url;
  if (typeof meta.fileId === "string" && /^[a-zA-Z0-9_-]{8,}$/.test(meta.fileId)) {
    return "https://drive.google.com/uc?export=download&id=" + meta.fileId;
  }
  return null;
}

function asList(feed, key, allow) {
  if (!allow || !feed || !Array.isArray(feed[key])) return [];
  return feed[key].filter((item) => item && typeof item === "object");
}

export function summarizeFeed(meta, entry, now) {
  const safe = meta && typeof meta === "object" ? meta : {};
  const feed = entry && entry.ok && entry.feed && typeof entry.feed === "object" ? entry.feed : null;
  const ai = String((feed && feed.ai) || safe.ai || "unknown");
  const label = String((feed && feed.label) || safe.label || ai);
  const placeholder = !!(feed && feed.placeholder);
  const reported = !!(feed && feed.ai && !placeholder);
  let signal = "no-signal";
  if (feed && reported) signal = "held";
  else if (feed) signal = "awaiting";
  const updated = feed && typeof feed.updated_at === "string" ? feed.updated_at : null;
  const age = updated ? now - Date.parse(updated) : Infinity;
  const stale = !Number.isFinite(age) || age > STALE_MS;
  return {
    ai,
    label,
    signal,
    updated,
    stale,
    reported,
    placeholder,
    specialists: asList(feed, "specialists", reported),
    scheduled: asList(feed, "scheduled", reported),
    chats: asList(feed, "chats", reported),
    recent: asList(feed, "recent", reported),
    recordedLive: asList(feed, "live", reported),
    err: entry && !entry.ok ? String(entry.err || "unavailable") : null
  };
}

export function signalLabel(signal) {
  if (signal === "held") return "Held";
  if (signal === "awaiting") return "Awaiting";
  return "No signal";
}

function plural(n, word) {
  return n + " " + word + (n === 1 ? "" : "s");
}

export function statusLine(houses, registryUpdated) {
  const list = Array.isArray(houses) ? houses : [];
  const held = list.filter((h) => h.signal === "held").length;
  const awaiting = list.filter((h) => h.signal === "awaiting").length;
  const silent = list.filter((h) => h.signal === "no-signal").length;
  const parts = [plural(list.length, "house")];
  if (held) parts.push(plural(held, "held report"));
  if (awaiting) parts.push(awaiting + " awaiting");
  if (silent) parts.push(plural(silent, "silent file"));
  const when = registryUpdated ? formatWhen(registryUpdated) : "—";
  return "Paused. " + parts.join(" · ") + ". Registry " + when + ". Nothing is polled.";
}

function tag(status) {
  const stored = status == null || status === "" ? "unknown" : String(status);
  const key = stored.toLowerCase();
  const shown = stored.replace(/_/g, " ");
  let cls = "";
  if (OK.has(key)) cls = "ok";
  else if (BAD.has(key)) cls = "nd";
  else if (key === "on_duty" || key === "running") cls = "st";
  else cls = "hold";
  return `<span class="tag ${cls}">${esc(shown)}</span>`;
}

function tally(jobs) {
  const out = { ok: 0, bad: 0, other: 0 };
  for (const job of jobs) {
    const key = String(job.last_status || "never").toLowerCase();
    if (OK.has(key)) out.ok += 1;
    else if (BAD.has(key)) out.bad += 1;
    else out.other += 1;
  }
  return out;
}

export function countsLine(house) {
  if (house.signal === "awaiting") return "Placeholder file. No crew, jobs, or chats in it yet.";
  if (house.signal === "no-signal") return "The file did not open. The bridge stays paused.";
  const bits = [
    plural(house.specialists.length, "specialist"),
    plural(house.scheduled.length, "scheduled job"),
    plural(house.chats.length, "chat")
  ];
  if (house.recordedLive.length) bits.push(plural(house.recordedLive.length, "recorded task"));
  const jobs = tally(house.scheduled);
  if (jobs.bad) bits.push(plural(jobs.bad, "recorded failure"));
  return bits.join(" · ");
}

export function houseCard(house, index) {
  const when = house.updated ? formatWhen(house.updated) : "No timestamp";
  return `<button type="button" class="card opener" data-i="${index}">
    <span class="row">
      <span class="card-title">${esc(house.label)}</span>
      ${tag(signalLabel(house.signal))}
    </span>
    <span class="meta">${esc(countsLine(house))}</span>
    <span class="meta">${esc(when)}</span>
  </button>`;
}

function fact(label, value) {
  return `<div class="fact"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
}

function jobLine(job) {
  const name = job.name || job.id || "job";
  const bits = [];
  if (job.schedule) bits.push(String(job.schedule));
  if (job.last_run) bits.push("last " + formatWhen(job.last_run));
  else bits.push("no recorded run");
  if (job.next_run) bits.push("recorded next " + formatWhen(job.next_run));
  return `<li>
    <span class="name">${esc(name)}</span>
    ${tag(job.last_status || "never")}
    <span class="when">${esc(bits.join(" · "))}</span>
  </li>`;
}

function personLine(person) {
  const name = person.name || person.id || "specialist";
  const role = person.specialty ? String(person.specialty) : "";
  return `<div class="roster">
    <span>${esc(name)}${role ? ` <span class="id">${esc(role)}</span>` : ""}</span>
    ${tag(person.status || "unknown")}
  </div>`;
}

function chatLine(chat) {
  const name = chat.name || chat.id || "chat";
  const when = chat.last_active ? formatWhen(chat.last_active) : "no timestamp";
  return `<li>
    <span class="name">${esc(name)}</span>
    ${tag(chat.status || "unknown")}
    <span class="when">${esc(when)}</span>
  </li>`;
}

function recentLine(item) {
  const name = item.name || item.id || "task";
  const when = item.completed_at ? formatWhen(item.completed_at) : "no timestamp";
  return `<li>
    <span class="name">${esc(name)}</span>
    ${tag(item.status || "unknown")}
    <span class="when">${esc(when)}</span>
  </li>`;
}

function taskBlock(task) {
  const name = task.name || task.id || "task";
  const bits = [];
  if (task.project) bits.push(String(task.project));
  if (task.specialist) bits.push(String(task.specialist));
  if (task.started_at) bits.push(formatWhen(task.started_at));
  return `<li>
    <span class="name">${esc(name)}</span>
    ${tag(task.status || "recorded")}
    <span class="when">${esc(bits.join(" · "))}</span>
    ${task.task ? `<span class="when">${esc(task.task)}</span>` : ""}
  </li>`;
}

function listBlock(title, items, render, empty, roster) {
  let body = `<p class="meta">${esc(empty)}</p>`;
  if (items.length && roster) body = `<div class="roster-list">${items.map(render).join("")}</div>`;
  else if (items.length) body = `<ul class="jobs">${items.map(render).join("")}</ul>`;
  return `<h3>${esc(title)}</h3>${body}`;
}

export function houseDetail(house) {
  const freshness = !house.updated
    ? "No timestamp in the file."
    : house.stale
      ? "Report " + formatWhen(house.updated) + ". Older than 45 minutes."
      : "Report " + formatWhen(house.updated) + ". Within 45 minutes, and still not watched.";
  const jobs = tally(house.scheduled);
  const jobSummary = house.scheduled.length
    ? [jobs.ok && (jobs.ok + " ok"), jobs.bad && (jobs.bad + " failed"), jobs.other && (jobs.other + " other")].filter(Boolean).join(" · ")
    : "None";
  const duty = house.specialists.filter((s) => String(s.status || "").toLowerCase() === "on_duty").length;
  return `<p class="kicker">${esc(signalLabel(house.signal))}</p>
    <h2 id="detail-title">${esc(house.label)}</h2>
    <p class="lede">${esc(freshness)} The bridge is paused, so this stays a held copy. Words below are the words in the file.</p>
    <div class="facts">
      ${fact("Signal", signalLabel(house.signal))}
      ${fact("House", house.ai)}
      ${fact("Specialists", house.specialists.length + (duty ? " · " + duty + " recorded on duty" : ""))}
      ${fact("Scheduled", jobSummary)}
      ${fact("Chats", String(house.chats.length))}
      ${fact("Recent", String(house.recent.length))}
      ${fact("Live list", String(house.recordedLive.length))}
      ${house.err ? fact("Note", house.err) : ""}
    </div>
    ${house.signal === "no-signal" || house.signal === "awaiting"
      ? `<p class="meta">${esc(countsLine(house))}</p>`
      : ""}
    ${listBlock("Specialists", house.specialists, personLine, "None in the file.", true)}
    ${listBlock("Scheduled jobs", house.scheduled, jobLine, "None in the file.")}
    ${listBlock("Chats", house.chats, chatLine, "None in the file.")}
    ${listBlock("Recent", house.recent, recentLine, "None in the file.")}
    ${listBlock("Live list", house.recordedLive, taskBlock, "None in the file.")}`;
}

export function historyBlock(history) {
  if (!history || typeof history !== "object") return "";
  const names = Object.keys(history).filter((key) => Array.isArray(history[key]) && history[key].length);
  if (!names.length) return "";
  const cards = names.map((name) => {
    const days = history[name];
    const last = days[days.length - 1] || {};
    const line = [
      last.date ? String(last.date) : "no date",
      "recorded live " + (last.live == null ? "—" : last.live),
      "scheduled " + (last.scheduled == null ? "—" : last.scheduled),
      "done " + (last.done == null ? "—" : last.done),
      "failed " + (last.failed == null ? "—" : last.failed)
    ].join(" · ");
    return `<article class="card">
      <div class="row"><h3>${esc(name)}</h3><span class="tag hold">rollup</span></div>
      <p class="meta">${esc(plural(days.length, "day"))} kept. Last row ${esc(line)}.</p>
    </article>`;
  }).join("");
  return `<div class="stack" id="rollup">${cards}</div>`;
}

export function housesMarkup(houses) {
  if (!houses.length) return `<p class="meta">The registry lists no houses.</p>`;
  return houses.map((house, index) => houseCard(house, index)).join("");
}

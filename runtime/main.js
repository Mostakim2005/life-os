var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.js
var main_exports = {};
__export(main_exports, {
  default: () => LifeOSPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian7 = require("obsidian");

// src/settings.js
var import_obsidian2 = require("obsidian");

// src/core/dates.js
var pad2 = (n) => String(n).padStart(2, "0");
var todayKey = (d = /* @__PURE__ */ new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
var parseKey = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  return new Date(y, m - 1, d);
};
var addDays = (key, n) => {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
};
var minutesToHHMM = (m) => {
  m = (Math.round(m) % 1440 + 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
};
var hhmmToMinutes = (s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  return m ? +m[1] * 60 + +m[2] : 0;
};
var timeDiffMinutes = (startHHMM, endHHMM) => {
  if (!startHHMM || !endHHMM) return 0;
  const s = hhmmToMinutes(startHHMM);
  const e = hhmmToMinutes(endHHMM);
  if (e >= s) return e - s;
  return 1440 - s + e;
};
var formatMinutes = (m) => {
  if (!m || m <= 0) return "0m";
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  if (h && mm) return `${h}h ${mm}m`;
  if (h) return `${h}h`;
  return `${mm}m`;
};
var weekKey = (key) => {
  const d = parseKey(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const w = Math.ceil(((t - ys) / 864e5 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad2(w)}`;
};
var weekDates = (key) => {
  const d = parseKey(key);
  const day = d.getDay() || 7;
  const monday = addDays(key, -(day - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};
var dayOfWeekName = (key) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parseKey(key).getDay()];
var humanDate = (key) => parseKey(key).toLocaleDateString(void 0, {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric"
});
var monthName = (d) => d.toLocaleDateString(void 0, { month: "long", year: "numeric" });
function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = (first.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// src/domain/habits.js
var EXERCISE_CONFIG = {
  Running: ["km", "min"],
  Walking: ["km", "min"],
  Cycling: ["km", "min"],
  Squat: ["sets", "reps", "load"],
  "Push-up": ["sets", "reps"],
  "Inclined Push-up": ["sets", "reps"],
  "Pull-up": ["sets", "reps"],
  Burpee: ["sets", "reps"],
  Lunge: ["sets", "reps", "load"],
  Plank: ["sets", "sec"],
  "Dead hang": ["sets", "sec"],
  Superman: ["sets", "reps"],
  "Reverse Superman": ["sets", "reps"],
  "Jumping jacks": ["sets", "reps"],
  "Wall sit": ["sets", "sec"],
  Crunch: ["sets", "reps"],
  "Dumbbell row": ["sets", "reps", "load"],
  Other: ["sets", "reps"]
};
var STUDY_SUBJECTS = [
  "Math",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Computer Science",
  "Programming",
  "Algorithms",
  "Electronics",
  "Biology",
  "English",
  "History",
  "Other"
];
var SCREEN_TYPES = [
  "Study",
  "Reading",
  "Work",
  "Social media",
  "YouTube",
  "Gaming",
  "News",
  "Other"
];
var DEFAULT_HABITS = [
  {
    id: "study",
    name: "Study",
    measure: "log",
    enabled: true,
    suggestions: [...STUDY_SUBJECTS],
    fields: { simple: ["min"], advanced: ["min", "focus", "planned", "note"] }
  },
  {
    id: "exercise",
    name: "Exercise",
    measure: "log",
    enabled: true,
    suggestions: Object.keys(EXERCISE_CONFIG),
    fields: { simple: [], advanced: [] }
  },
  {
    id: "water",
    name: "Water",
    measure: "amount",
    enabled: true,
    unit: "glass",
    target: { value: 8, unit: "glass" },
    step: 1
  },
  {
    id: "tidy",
    name: "Room tidy",
    measure: "checklist",
    enabled: true,
    items: ["Bed", "Desk", "Floor", "Clothes", "Trash"]
  },
  {
    id: "screen",
    name: "Screen discipline",
    measure: "log",
    enabled: true,
    suggestions: SCREEN_TYPES,
    fields: { simple: ["min"], advanced: ["min", "note"] }
  },
  {
    id: "reading",
    name: "Reading",
    measure: "log",
    enabled: true,
    suggestions: ["Book", "Article", "Paper", "Quran"],
    fields: { simple: ["min"], advanced: ["min", "pages", "note"] }
  }
];
function findHabitGroup(doc, habit) {
  const s = doc._byName.get("Habits");
  if (!s || !s.parsed) return null;
  return s.parsed.find((g) => g.id === habit.id) || s.parsed.find((g) => g.name === habit.name) || null;
}
function computeStatus(habit, entries) {
  if (!entries || !entries.length) return "none";
  const m = habit.measure;
  if (m === "levels") {
    let best = "none";
    for (const e of entries) {
      const lv = String(e.fields.get("level") || "").toLowerCase();
      if (lv === "full" || lv === "done") return "done";
      if (lv === "partial") best = "partial";
    }
    return best;
  }
  if (m === "checklist") {
    const top = entries.filter((e) => e.checkbox !== null && e.indent === 0);
    if (!top.length) return "none";
    let done = 0;
    let partial = 0;
    for (const e of top) {
      if (e.checkbox === "x") done++;
      else if (e.checkbox === "/") partial++;
    }
    if (done === top.length) return "done";
    if (done > 0 || partial > 0) return "partial";
    return "none";
  }
  if (m === "amount") {
    const sum = entries.reduce((a, e) => a + Number(e.fields.get("count") || 0), 0);
    const target2 = habit.target && habit.target.value ? habit.target.value : 0;
    if (target2 > 0) {
      if (sum >= target2) return "done";
      if (sum > 0) return "partial";
      return "none";
    }
    return sum > 0 ? "done" : "none";
  }
  const target = habit.target && habit.target.value ? habit.target.value : 0;
  if (target > 0) {
    const sum = entries.reduce((a, e) => a + Number(e.fields.get("min") || 0), 0);
    if (sum >= target) return "done";
    if (sum > 0) return "partial";
    return "none";
  }
  return entries.length ? "done" : "none";
}
function exerciseSummary(label, f) {
  const bits = [label || "(exercise)"];
  const sets = f.get("sets");
  const reps = f.get("reps");
  const sec = f.get("sec");
  if (sets && reps) bits.push(`${sets}\xD7${reps}`);
  else if (sets && sec) bits.push(`${sets}\xD7${sec}s`);
  else if (sets) bits.push(`${sets} sets`);
  else if (reps) bits.push(`${reps} reps`);
  else if (sec) bits.push(`${sec}s`);
  const km = f.get("km");
  if (km) bits.push(`${km} km`);
  const min = f.get("min");
  if (min) bits.push(`${min}m`);
  const load = f.get("load");
  if (load) bits.push(`${load}kg`);
  return bits.join(" \xB7 ");
}
function summarize(habit, entries) {
  if (!entries || !entries.length) return "\u2014";
  const m = habit.measure;
  if (habit.id === "study") {
    const total = entries.reduce(
      (sum, entry) => sum + Math.max(0, Number(entry.fields.get("min") || 0)),
      0
    );
    return `${formatMinutes(total)} total`;
  }
  if (m === "levels") {
    let lv = "";
    for (const e of entries) {
      const v = String(e.fields.get("level") || "").toLowerCase();
      if (v === "full") lv = "full";
      else if (v === "partial" && lv !== "full") lv = "partial";
      else if (v && !lv) lv = v;
    }
    const label = lv === "full" ? "\u25C9 full" : lv === "partial" ? "\u25D0 partial" : lv || "\u2014";
    const mins = entries.reduce((a, e) => a + Number(e.fields.get("min") || 0), 0);
    return mins ? `${label} \xB7 ${mins}m` : label;
  }
  if (m === "checklist") {
    const top = entries.filter((e) => e.checkbox !== null && e.indent === 0);
    if (!top.length) return "\u2014";
    const done = top.filter((e) => e.checkbox === "x").length;
    const partial = top.filter((e) => e.checkbox === "/").length;
    return `${done}/${top.length} done${partial ? ` \xB7 ${partial} partial` : ""}`;
  }
  if (m === "amount") {
    const sum = entries.reduce((a, e) => a + Number(e.fields.get("count") || 0), 0);
    const target2 = habit.target && habit.target.value || 0;
    const unit = habit.unit || "unit";
    if (target2 > 0) return `${sum} of ${target2} ${unit}${target2 === 1 ? "" : "s"}`;
    return `${sum} ${unit}${sum === 1 ? "" : "s"}`;
  }
  if (habit.id === "exercise") {
    return entries.map((e) => exerciseSummary(e.label, e.fields)).join(" \xB7 ");
  }
  const parts = entries.map((e) => {
    const bits = [e.label || "(entry)"];
    const min = e.fields.get("min");
    if (min) bits.push(`${min}m`);
    const note = e.fields.get("note");
    if (note) bits.push(`(${note})`);
    return bits.join(" ");
  });
  const text = parts.join(" \xB7 ");
  const target = habit.target && habit.target.value;
  if (target) {
    const total = entries.reduce((a, e) => a + Number(e.fields.get("min") || 0), 0);
    return `${text} \xB7 ${formatMinutes(total)} of ${formatMinutes(target)}`;
  }
  return text;
}

// src/core/grammar.js
var FIELD_RE = /\[([A-Za-z][\w-]*)::\s*([^\]]*)\]/g;
function parseFields(str) {
  const fields = /* @__PURE__ */ new Map();
  const cleaned = String(str == null ? "" : str).replace(FIELD_RE, (_, k, v) => {
    fields.set(k, String(v).trim());
    return "";
  });
  return { label: cleaned.replace(/\s+/g, " ").trim(), fields };
}
function serializeFields(label, fields) {
  const parts = [];
  if (label) parts.push(label);
  if (fields) {
    const entries = fields instanceof Map ? fields.entries() : Object.entries(fields);
    for (const [k, v] of entries) {
      if (v !== void 0 && v !== null && v !== "") {
        parts.push(`[${k}:: ${v}]`);
      }
    }
  }
  return parts.join(" ");
}

// src/core/daydoc.js
var SECTION_ORDER = ["Prayers", "Habits", "Tasks", "Timeline", "Reflection"];
var PRAYER_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
function parseFrontmatter(text) {
  const out = {};
  if (!text) return out;
  for (const line of String(text).split("\n")) {
    const m = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line);
    if (m) {
      let val = m[2].trim();
      if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      out[m[1]] = val;
    }
  }
  return out;
}
function parseDay(text) {
  const lines = String(text || "").split("\n");
  let i = 0, fm = "", hasFm = false;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      fm = lines.slice(1, end).join("\n");
      hasFm = true;
      i = end + 1;
      if (lines[i] === "") i++;
    }
  }
  const sections = [];
  const preamble = [];
  let cur = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      cur = { name: m[1], raw: [], parsed: null, dirty: false, virtual: false };
      sections.push(cur);
    } else if (cur) {
      cur.raw.push(line);
    } else {
      preamble.push(line);
    }
  }
  const meta = parseFrontmatter(fm);
  const doc = {
    ok: hasFm && String(meta["life-os"]) === "2",
    hasFrontmatter: hasFm,
    frontmatter: fm,
    meta,
    preamble,
    sections,
    _byName: /* @__PURE__ */ new Map()
  };
  for (const s of sections) {
    doc._byName.set(s.name, s);
  }
  for (const name of SECTION_ORDER) {
    if (!doc._byName.has(name)) {
      const s = { name, raw: [], parsed: null, dirty: false, virtual: true };
      sections.push(s);
      doc._byName.set(name, s);
    }
  }
  for (const name of SECTION_ORDER) {
    const s = doc._byName.get(name);
    s.parsed = parseSection(name, s.raw);
  }
  return doc;
}
function parseSection(name, raw) {
  if (name === "Prayers") return parsePrayers(raw);
  if (name === "Habits") return parseHabits(raw);
  if (name === "Tasks") return parseTasks(raw);
  if (name === "Timeline") return parseTimeline(raw);
  if (name === "Reflection") return { text: raw.join("\n").replace(/^\n+|\n+$/g, "") };
  return null;
}
function parsePrayers(raw) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const unknown = [];
  for (const line of raw) {
    const m = /^\s*-\s+(?:\[([ x/])\]\s*)?(.+)$/.exec(line);
    if (!m) {
      if (line.trim()) unknown.push(line);
      continue;
    }
    const { label, fields } = parseFields(m[2]);
    const name = label.trim();
    if (!PRAYER_NAMES.includes(name)) {
      unknown.push(line);
      continue;
    }
    const status = fields.get("status") || (m[1] === "x" ? "done" : "");
    out.push({
      name,
      time: fields.get("time") || "",
      status,
      fields,
      raw: line
    });
    seen.add(name);
  }
  for (const name of PRAYER_NAMES) {
    if (!seen.has(name)) {
      out.push({ name, time: "", status: "", fields: /* @__PURE__ */ new Map(), raw: "" });
    }
  }
  out.sort((a, b) => PRAYER_NAMES.indexOf(a.name) - PRAYER_NAMES.indexOf(b.name));
  out._unknownLines = unknown;
  return out;
}
function parseHabits(raw) {
  const groups = [];
  let cur = null;
  for (const line of raw) {
    const h = /^###\s+(.+?)\s*$/.exec(line);
    if (h) {
      const cm = /%%\s*habit:([\w-]+)\s*%%/.exec(h[1]);
      cur = {
        id: cm ? cm[1] : "",
        name: h[1].replace(/%%[^%]*%%/g, "").trim(),
        entries: [],
        raw: [line]
      };
      groups.push(cur);
      continue;
    }
    if (!cur) continue;
    cur.raw.push(line);
    if (!line.trim()) continue;
    const m = /^(\s*)-\s+(.*)$/.exec(line);
    if (!m) {
      cur.entries.push({ unknown: true, raw: line });
      continue;
    }
    const indent = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    let rest = m[2];
    let checkbox = null;
    const cb = /^\[([ x/])\]\s*(.*)$/.exec(rest);
    if (cb) {
      checkbox = cb[1];
      rest = cb[2];
    }
    const { label, fields } = parseFields(rest);
    cur.entries.push({ indent, checkbox, label, fields, raw: line });
  }
  return groups;
}
function parseTasks(raw) {
  const out = [];
  const unknown = [];
  for (let index = 0; index < raw.length; index++) {
    const line = raw[index];
    const m = /^(\s*)-\s+\[([ x/])\]\s+(.*)$/.exec(line);
    if (!m) {
      if (line.trim()) unknown.push(line);
      continue;
    }
    let taskBody = m[3];
    const dueDate = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(taskBody);
    const scheduledDate = /⏳\s*(\d{4}-\d{2}-\d{2})/.exec(taskBody);
    const recurrence = /🔁\s*(.+?)(?=\s+(?:📅|⏳|⏫|🔼|🔽)|\s+\[[^\]]+::|$)/.exec(taskBody);
    const priorityMatch = /(⏫|🔼|🔽)/.exec(taskBody);
    taskBody = taskBody.replace(/\s+📅\s*\d{4}-\d{2}-\d{2}/g, "").replace(/\s+⏳\s*\d{4}-\d{2}-\d{2}/g, "").replace(/\s+🔁\s*.+?(?=\s+(?:📅|⏳|⏫|🔼|🔽)|\s+\[[^\]]+::|$)/, "").replace(/\s+(⏫|🔼|🔽)/g, "");
    const { label, fields } = parseFields(taskBody);
    if (dueDate) fields.set("dueDate", dueDate[1]);
    if (scheduledDate) fields.set("scheduledDate", scheduledDate[1]);
    if (recurrence) fields.set("recurrence", recurrence[1]);
    if (priorityMatch) {
      const p = priorityMatch[1] === "\u23EB" ? "high" : priorityMatch[1] === "\u{1F53C}" ? "medium" : "low";
      fields.set("priority", p);
    }
    const indent = Math.floor(m[1].replace(/\t/g, "  ").length / 2);
    if (!fields.has("id")) {
      let hash = 0;
      for (const ch of label) hash = (hash << 5) - hash + ch.charCodeAt(0) | 0;
      fields.set("id", `t-${index}-${Math.abs(hash).toString(36)}`);
    }
    out.push({
      checkbox: m[2],
      checked: m[2] === "x",
      label,
      fields,
      raw: line,
      indent,
      id: fields.get("id") || ""
    });
  }
  out._unknownLines = unknown;
  return out;
}
var BLOCK_RE = /^\s*-\s+(?:\[([ x])\]\s*)?(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s+(.*)$/;
function parseTimeline(raw) {
  const out = [];
  const unknown = [];
  for (const line of raw) {
    const m = BLOCK_RE.exec(line);
    if (!m) {
      if (line.trim()) unknown.push(line);
      continue;
    }
    const start = +m[2] * 60 + +m[3];
    const end = +m[4] * 60 + +m[5];
    if (end <= start) continue;
    const { label, fields } = parseFields(m[6]);
    const kind = fields.get("kind") || "free";
    out.push({
      start,
      end,
      label,
      fields,
      raw: line,
      kind,
      checked: m[1] === "x",
      id: fields.get("task") || fields.get("habit") || `${start}-${end}-${label}`
    });
  }
  out._unknownLines = unknown;
  return out;
}
function serializeHabitEntry(e) {
  if (e.unknown) return e.raw;
  const indent = "  ".repeat(e.indent || 0);
  const parts = [];
  if (e.checkbox !== null && e.checkbox !== void 0) parts.push(`[${e.checkbox}]`);
  if (e.label) parts.push(e.label);
  for (const [k, v] of e.fields) {
    if (v !== void 0 && v !== null && v !== "") {
      parts.push(`[${k}:: ${v}]`);
    }
  }
  return `${indent}- ${parts.join(" ")}`;
}
function serializeSection(name, parsed) {
  if (name === "Prayers") {
    const out = parsed.map((p) => {
      const isDone = p.status === "done" || p.status === "jamaah";
      const parts = [`[${isDone ? "x" : " "}]`, p.name];
      if (p.time) parts.push(`[time:: ${p.time}]`);
      if (p.status) parts.push(`[status:: ${p.status}]`);
      return `- ${parts.join(" ")}`;
    });
    if (parsed._unknownLines && parsed._unknownLines.length) {
      out.push(...parsed._unknownLines);
    }
    return out;
  }
  if (name === "Habits") {
    const out = [];
    for (const g of parsed) {
      const comment = g.id ? ` %% habit:${g.id} %%` : "";
      out.push(`### ${g.name}${comment}`);
      for (const e of g.entries) out.push(serializeHabitEntry(e));
      out.push("");
    }
    while (out.length && out[out.length - 1] === "") out.pop();
    return out;
  }
  if (name === "Tasks") {
    const out = parsed.map((t) => {
      const fields = new Map(t.fields);
      const dueDate = fields.get("dueDate");
      const scheduledDate = fields.get("scheduledDate");
      const recurrence = fields.get("recurrence");
      const priority = fields.get("priority");
      fields.delete("dueDate");
      fields.delete("scheduledDate");
      fields.delete("recurrence");
      fields.delete("priority");
      const task = serializeFields(t.label, fields);
      const parts = [];
      if (priority === "high") parts.push("\u23EB");
      else if (priority === "medium") parts.push("\u{1F53C}");
      else if (priority === "low") parts.push("\u{1F53D}");
      if (/^every\s+.+$/i.test(recurrence || "")) parts.push(`\u{1F501} ${recurrence}`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate || "")) parts.push(`\u{1F4C5} ${dueDate}`);
      if (/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate || "")) parts.push(`\u23F3 ${scheduledDate}`);
      const fullTask = [task, ...parts].filter(Boolean).join(" ");
      return `${"  ".repeat(Math.max(0, t.indent || 0))}- [${t.checkbox || (t.checked ? "x" : " ")}] ${fullTask}`;
    });
    if (parsed._unknownLines && parsed._unknownLines.length) {
      out.push(...parsed._unknownLines);
    }
    return out;
  }
  if (name === "Timeline") {
    const out = parsed.map((b) => {
      const s = `${pad2(Math.floor(b.start / 60))}:${pad2(b.start % 60)}`;
      const e = `${pad2(Math.floor(b.end / 60))}:${pad2(b.end % 60)}`;
      return `- [${b.checked ? "x" : " "}] ${s} - ${e} ${serializeFields(b.label, b.fields)}`;
    });
    if (parsed._unknownLines && parsed._unknownLines.length) {
      out.push(...parsed._unknownLines);
    }
    return out;
  }
  if (name === "Reflection") {
    return parsed.text ? parsed.text.split("\n") : [];
  }
  return [];
}
function serializeDay(doc) {
  const out = [];
  if (doc.frontmatter.trim()) {
    out.push("---", doc.frontmatter.trim(), "---", "");
  }
  for (const p of doc.preamble) {
    out.push(p);
  }
  if (doc.preamble.length && doc.preamble[doc.preamble.length - 1] !== "") {
    out.push("");
  }
  for (const s of doc.sections) {
    const hasRaw = s.raw && s.raw.some((l) => l.trim() !== "");
    const hasParsed = Array.isArray(s.parsed) ? s.parsed.length > 0 : s.parsed && typeof s.parsed === "object" && "text" in s.parsed ? !!s.parsed.text : false;
    if (!s.dirty) {
      if (!hasRaw && s.virtual) continue;
    } else {
      if (!hasParsed && !hasRaw) continue;
    }
    out.push(`## ${s.name}`);
    if (s.dirty) {
      for (const line of serializeSection(s.name, s.parsed)) {
        out.push(line);
      }
    } else {
      for (const line of s.raw) {
        out.push(line);
      }
    }
    out.push("");
  }
  while (out.length && out[out.length - 1] === "") {
    out.pop();
  }
  return out.join("\n") + "\n";
}
function ensureHabitGroup(doc, habitId, habitName) {
  const s = doc._byName.get("Habits");
  let group = s.parsed.find((g) => g.id === habitId) || s.parsed.find((g) => g.name === habitName);
  if (!group) {
    group = { id: habitId, name: habitName, entries: [], raw: [] };
    s.parsed.push(group);
  }
  return group;
}
function addHabitEntry(doc, habitId, habitName, entry) {
  const s = doc._byName.get("Habits");
  s.dirty = true;
  const group = ensureHabitGroup(doc, habitId, habitName);
  group.entries.push({
    indent: 0,
    checkbox: entry.checkbox == null ? null : entry.checkbox,
    label: entry.label || "",
    fields: entry.fields || /* @__PURE__ */ new Map(),
    raw: ""
  });
}
function setPrayer(doc, name, patch) {
  const s = doc._byName.get("Prayers");
  s.dirty = true;
  const p = s.parsed.find((x) => x.name === name);
  if (!p) return;
  if ("time" in patch) {
    p.time = patch.time || "";
    if (patch.time) p.fields.set("time", patch.time);
    else p.fields.delete("time");
  }
  if ("status" in patch) {
    p.status = patch.status || "";
    if (patch.status) p.fields.set("status", patch.status);
    else p.fields.delete("status");
  }
}
function toggleTask(doc, id) {
  const s = doc._byName.get("Tasks");
  s.dirty = true;
  const t = s.parsed.find((x) => x.id === id);
  if (!t) return;
  t.checked = !t.checked;
  t.checkbox = t.checked ? "x" : " ";
}
function addTask(doc, label, fields, indent = 0, parentId = null) {
  const s = doc._byName.get("Tasks");
  s.dirty = true;
  const f = fields || /* @__PURE__ */ new Map();
  if (!f.has("id")) {
    f.set("id", `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);
  }
  const item = {
    checkbox: " ",
    checked: false,
    label,
    fields: f,
    raw: "",
    id: f.get("id"),
    indent: Math.max(0, Number(indent) || 0)
  };
  if (parentId) {
    const parentIndex = s.parsed.findIndex((task) => task.id === parentId);
    if (parentIndex >= 0) {
      const parentDepth = s.parsed[parentIndex].indent || 0;
      let insertAt = parentIndex + 1;
      while (insertAt < s.parsed.length && (s.parsed[insertAt].indent || 0) > parentDepth) {
        insertAt++;
      }
      s.parsed.splice(insertAt, 0, item);
      return;
    }
  }
  s.parsed.push(item);
}
function updateTask(doc, id, patch) {
  const s = doc._byName.get("Tasks");
  s.dirty = true;
  const t = s.parsed.find((x) => x.id === id);
  if (!t) return;
  if (patch.label != null) t.label = patch.label;
  if (patch.fields) t.fields = patch.fields;
  if (patch.checked != null) {
    t.checked = !!patch.checked;
    t.checkbox = t.checked ? "x" : " ";
  }
}
function removeTask(doc, id) {
  const s = doc._byName.get("Tasks");
  s.dirty = true;
  const index = s.parsed.findIndex((t) => t.id === id);
  if (index < 0) return;
  const depth = s.parsed[index].indent || 0;
  let end = index + 1;
  while (end < s.parsed.length && (s.parsed[end].indent || 0) > depth) {
    end++;
  }
  s.parsed.splice(index, end - index);
}
function setReflection(doc, text) {
  const s = doc._byName.get("Reflection");
  s.dirty = true;
  s.parsed = { text: String(text || "").replace(/^\n+|\n+$/g, "") };
}
function setFrontmatterScalar(doc, key, value) {
  const lines = doc.frontmatter ? doc.frontmatter.split("\n") : [];
  let found = false;
  for (let i = 0; i < lines.length; i++) {
    const m = /^([A-Za-z][\w-]*)\s*:/.exec(lines[i]);
    if (m && m[1] === key) {
      lines[i] = `${key}: ${value == null ? "" : value}`.trimEnd();
      found = true;
      break;
    }
  }
  if (!found) {
    lines.push(`${key}: ${value == null ? "" : value}`.trimEnd());
  }
  doc.frontmatter = lines.join("\n");
  doc.meta[key] = String(value == null ? "" : value);
}
function newDayText(date, settings) {
  const habits = (settings.habits || []).filter((h) => h.enabled);
  let habitBlocks = "";
  for (const h of habits) {
    habitBlocks += `
### ${h.name} %% habit:${h.id} %%
`;
    if (h.measure === "checklist" && h.items && h.items.length) {
      for (const it of h.items) {
        habitBlocks += `- [ ] ${it}
`;
      }
    }
  }
  return `---
life-os: 2
date: ${date}
sleep:
bedtime:
waketime:
mood:
energy:
water: 0
---

## Prayers
- [ ] Fajr
- [ ] Dhuhr
- [ ] Asr
- [ ] Maghrib
- [ ] Isha

## Habits
${habitBlocks}
## Tasks

## Timeline

## Reflection
`;
}

// src/domain/prayer.js
var DEG = Math.PI / 180;
var dsin = (d) => Math.sin(d * DEG);
var dcos = (d) => Math.cos(d * DEG);
var dtan = (d) => Math.tan(d * DEG);
var darcsin = (x) => Math.asin(x) / DEG;
var darccos = (x) => Math.acos(Math.max(-1, Math.min(1, x))) / DEG;
var darctan2 = (y, x) => Math.atan2(y, x) / DEG;
var darccot = (x) => Math.atan(1 / x) / DEG;
var fixAngle = (a) => (a % 360 + 360) % 360;
var fixHour = (a) => (a % 24 + 24) % 24;
var PRAYER_METHODS = {
  MuslimWorldLeague: { fajr: 18, isha: 17 },
  Egyptian: { fajr: 19.5, isha: 17.5 },
  Karachi: { fajr: 18, isha: 18 },
  UmmAlQura: { fajr: 18.5, isha: "90 min" },
  Dubai: { fajr: 18.2, isha: 18.2 },
  MoonsightingCommittee: { fajr: 18, isha: 18 },
  NorthAmerica: { fajr: 15, isha: 15 },
  Kuwait: { fajr: 18, isha: 17.5 },
  Qatar: { fajr: 18, isha: 18 },
  Singapore: { fajr: 20, isha: 18 },
  Turkey: { fajr: 18, isha: 17 },
  Tehran: { fajr: 17.7, isha: 14 }
};
function julianDate(y, m, d) {
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}
function sunPosition(jd) {
  const D = jd - 2451545;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 36e-8 * D;
  const RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  const eqt = q / 15 - fixHour(RA);
  const decl = darcsin(dsin(e) * dsin(L));
  return { declination: decl, equation: eqt };
}
function computePrayerTimes(dateKey, settings) {
  const d = parseKey(dateKey);
  const lat = Number(settings.latitude);
  const lng = Number(settings.longitude);
  const tz = -d.getTimezoneOffset() / 60;
  const method = PRAYER_METHODS[settings.method] || PRAYER_METHODS.Karachi;
  const isHanafi = settings.madhab === "hanafi";
  const adj = settings.adjustments || {};
  const jd = julianDate(d.getFullYear(), d.getMonth() + 1, d.getDate()) - lng / (15 * 24);
  const sun = sunPosition(jd);
  const decl = sun.declination;
  const eqt = sun.equation;
  const dhuhr = 12 + tz - lng / 15 - eqt;
  const angleT = (angle, before) => {
    const x = (-dsin(angle) - dsin(decl) * dsin(lat)) / (dcos(decl) * dcos(lat));
    const t = 1 / 15 * darccos(x);
    return before ? dhuhr - t : dhuhr + t;
  };
  const sunrise = angleT(-0.833, true);
  const maghrib = angleT(-0.833, false);
  const fajr = angleT(method.fajr, true);
  const asrAngle = -darccot((isHanafi ? 2 : 1) + dtan(Math.abs(lat - decl)));
  const asr = angleT(asrAngle, false);
  let isha;
  if (typeof method.isha === "string") {
    const m = /(\d+(?:\.\d+)?)\s*min/.exec(method.isha);
    isha = maghrib + (m ? Number(m[1]) / 60 : 1.5);
  } else {
    isha = angleT(method.isha, false);
  }
  const off = (k) => (Number(adj[k]) || 0) / 60;
  const times = {
    Fajr: minutesToHHMM((fajr + off("fajr")) * 60),
    Sunrise: minutesToHHMM((sunrise + off("sunrise")) * 60),
    Dhuhr: minutesToHHMM((dhuhr + off("dhuhr")) * 60),
    Asr: minutesToHHMM((asr + off("asr")) * 60),
    Maghrib: minutesToHHMM((maghrib + off("maghrib")) * 60),
    Isha: minutesToHHMM((isha + off("isha")) * 60)
  };
  const manual = settings.manualTimes || {};
  const imported = settings.scheduleOverrides && settings.scheduleOverrides[dateKey] || {};
  const keys = {
    Fajr: "fajr",
    Sunrise: "sunrise",
    Dhuhr: "dhuhr",
    Asr: "asr",
    Maghrib: "maghrib",
    Isha: "isha"
  };
  for (const [name, key] of Object.entries(keys)) {
    const value = String(imported[name] || manual[name] || "");
    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      times[name] = minutesToHHMM(hhmmToMinutes(value) + (Number(adj[key]) || 0));
    }
  }
  return times;
}
function getNextPrayer(times, now = /* @__PURE__ */ new Date()) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const sequence = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
  for (const name of sequence) {
    const timeStr = times[name];
    if (!timeStr) continue;
    const prayerMin = hhmmToMinutes(timeStr);
    if (prayerMin > currentMinutes) {
      const diff2 = prayerMin - currentMinutes;
      const hours2 = Math.floor(diff2 / 60);
      const mins2 = diff2 % 60;
      const countdown = hours2 > 0 ? `${hours2}h ${mins2}m` : `${mins2}m`;
      return { name, time: timeStr, minutesRemaining: diff2, countdown };
    }
  }
  const fajrStr = times["Fajr"] || "05:00";
  const fajrMin = hhmmToMinutes(fajrStr);
  const diff = 1440 - currentMinutes + fajrMin;
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  return {
    name: "Fajr (Tomorrow)",
    time: fajrStr,
    minutesRemaining: diff,
    countdown: `${hours}h ${mins}m`
  };
}
function computePrayerBlocks(dateKey, settings) {
  const times = computePrayerTimes(dateKey, settings.prayer || settings);
  const len = settings.timeline && settings.timeline.prayerBlockLength || 20;
  return PRAYER_NAMES.map((name) => {
    const t = times[name];
    if (!t) return null;
    const start = hhmmToMinutes(t);
    return {
      id: `prayer-${name}`,
      start,
      end: Math.min(start + len, 1440),
      label: name,
      kind: "prayer",
      fixed: true
    };
  }).filter(Boolean);
}
async function writeTimesToDay(plugin, dateKey) {
  const times = computePrayerTimes(dateKey, plugin.settings.prayer || plugin.settings);
  await plugin.store.updateDay(dateKey, (doc) => {
    for (const name of PRAYER_NAMES) {
      if (times[name]) {
        setPrayer(doc, name, { time: times[name] });
      }
    }
  });
}

// src/ui/modals.js
var import_obsidian = require("obsidian");
var HabitPickerModal = class extends import_obsidian.SuggestModal {
  constructor(app, plugin, onPick) {
    super(app);
    this.plugin = plugin;
    this.onPick = onPick;
    this.setPlaceholder("Choose a habit or activity to log\u2026");
  }
  getSuggestions(query) {
    const q = (query || "").toLowerCase();
    return this.plugin.settings.habits.filter(
      (h) => h.enabled && (!q || h.name.toLowerCase().includes(q))
    );
  }
  renderSuggestion(h, el) {
    el.setText(h.name);
  }
  onChooseSuggestion(h) {
    this.onPick(h);
  }
};
function buildMinutesWidget(parent, initial = 0, options = {}) {
  let value = Math.max(0, Number(initial) || 0);
  let step = Math.max(1, Number(options.step) || 15);
  const stepOptions = options.stepOptions || [5, 10, 15, 30, 45, 60];
  const wrap = parent.createDiv({ cls: "life-os-min-row" });
  const minus = wrap.createEl("button", {
    cls: "life-os-min-btn life-os-min-stepper-btn",
    text: "\u2212"
  });
  minus.setAttribute("aria-label", "Decrease minutes");
  const disp = wrap.createEl("input", {
    cls: "life-os-min-display",
    type: "number"
  });
  disp.min = "0";
  disp.step = String(step);
  disp.value = String(value);
  wrap.createSpan({ cls: "life-os-min-unit", text: "min" });
  const plus = wrap.createEl("button", {
    cls: "life-os-min-btn life-os-min-stepper-btn",
    text: "+"
  });
  plus.setAttribute("aria-label", "Increase minutes");
  const presets = wrap.createDiv({ cls: "life-os-min-presets" });
  for (const p of [15, 30, 45, 60]) {
    const btn = presets.createEl("button", {
      text: `${p}m`,
      cls: `life-os-preset-btn ${value === p ? "is-active" : ""}`
    });
    btn.onclick = () => set(p);
  }
  const render = () => {
    disp.value = String(value);
    minus.disabled = value <= 0;
    presets.querySelectorAll(".life-os-preset-btn").forEach((b) => {
      b.classList.toggle("is-active", b.textContent === `${value}m`);
    });
  };
  const set = (v) => {
    value = Math.max(0, Math.round(Number(v) || 0));
    render();
  };
  minus.onclick = () => set(value - step);
  plus.onclick = () => set(value + step);
  disp.oninput = () => {
    value = Math.max(0, Number(disp.value) || 0);
    minus.disabled = value <= 0;
  };
  disp.onchange = () => set(disp.value);
  render();
  return { get: () => value, set, getStep: () => step };
}
var LogEntryModal = class extends import_obsidian.Modal {
  constructor(app, plugin, habit, date = todayKey()) {
    super(app);
    this.plugin = plugin;
    this.habit = habit;
    this.date = date || todayKey();
    this.values = /* @__PURE__ */ new Map();
    this.labelValue = "";
    this.noteValue = "";
    this._minutes = null;
    this.studySubject = "";
    this.studyTopic = "";
    this.studySubtopic = "";
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const h = this.habit;
    contentEl.createEl("h2", { text: `Log \xB7 ${h.name}` });
    await this.plugin.store.history.initHistory();
    const form = contentEl.createDiv({ cls: "life-os-form" });
    if (h.id === "study") this._buildStudyForm(form);
    else if (h.id === "exercise") this._buildExerciseForm(form);
    else if (h.id === "screen") this._buildScreenForm(form);
    else if (h.id === "reading") this._buildReadingForm(form);
    else this._buildGenericLogForm(form);
    const btns = contentEl.createDiv({ cls: "life-os-modal-buttons" });
    btns.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    btns.createEl("button", { text: "Save Entry", cls: "mod-cta" }).onclick = () => this.save();
  }
  _createDatalist(parent, id, values) {
    const list = parent.createEl("datalist");
    list.id = id;
    this._setDatalist(list, values);
    return list;
  }
  _setDatalist(list, values) {
    list.empty();
    const unique = [
      ...new Set((values || []).map((v) => String(v || "").trim()).filter(Boolean))
    ];
    for (const value of unique) {
      list.createEl("option", { value });
    }
  }
  _buildStudyForm(form) {
    const history = this.plugin.store.history;
    const subjectField = form.createDiv({ cls: "life-os-field" });
    subjectField.createEl("label", { text: "Subject (Choose past or type new)" });
    const subjectInput = subjectField.createEl("input", {
      type: "text",
      placeholder: "e.g. Physics, Mathematics, Machine Learning\u2026"
    });
    const subjectList = this._createDatalist(
      subjectField,
      `dl-study-subj-${Date.now()}`,
      history.getStudySubjects()
    );
    subjectInput.setAttribute("list", subjectList.id);
    const topicField = form.createDiv({ cls: "life-os-field" });
    topicField.createEl("label", { text: "Topic" });
    const topicInput = topicField.createEl("input", {
      type: "text",
      placeholder: "e.g. Thermodynamics, Linear Algebra, NLP\u2026"
    });
    const topicList = this._createDatalist(
      topicField,
      `dl-study-topic-${Date.now()}`,
      history.getStudyTopics("")
    );
    topicInput.setAttribute("list", topicList.id);
    const subtopicField = form.createDiv({ cls: "life-os-field" });
    subtopicField.createEl("label", { text: "Subtopic (optional)" });
    const subtopicInput = subtopicField.createEl("input", {
      type: "text",
      placeholder: "e.g. Carnot Cycle, Eigenvalues\u2026"
    });
    const subtopicList = this._createDatalist(
      subtopicField,
      `dl-study-subtopic-${Date.now()}`,
      []
    );
    subtopicInput.setAttribute("list", subtopicList.id);
    const onSubjectChange = () => {
      this.studySubject = subjectInput.value.trim();
      const pastTopics = history.getStudyTopics(this.studySubject);
      this._setDatalist(topicList, pastTopics);
    };
    const onTopicChange = () => {
      this.studyTopic = topicInput.value.trim();
      const pastSubtopics = history.getStudySubtopics(this.studyTopic);
      this._setDatalist(subtopicList, pastSubtopics);
    };
    subjectInput.oninput = onSubjectChange;
    subjectInput.onchange = onSubjectChange;
    topicInput.oninput = onTopicChange;
    topicInput.onchange = onTopicChange;
    subtopicInput.oninput = () => {
      this.studySubtopic = subtopicInput.value.trim();
    };
    const mwrap = form.createDiv({ cls: "life-os-field" });
    mwrap.createEl("label", { text: "Duration" });
    this._minutes = buildMinutesWidget(mwrap, 30, { step: 15 });
    const note = form.createDiv({ cls: "life-os-field" });
    note.createEl("label", { text: "Session notes (optional)" });
    const nIn = note.createEl("input", {
      type: "text",
      placeholder: "Key takeaways, exercise problems completed, or page numbers"
    });
    nIn.oninput = () => {
      this.noteValue = nIn.value;
    };
  }
  _buildExerciseForm(form) {
    const history = this.plugin.store.history;
    const labelWrap = form.createDiv({ cls: "life-os-field" });
    labelWrap.createEl("label", { text: "Exercise Movement (Choose past or type new)" });
    const input = labelWrap.createEl("input", {
      type: "text",
      placeholder: "e.g. Running, Squat, Push-up, Deadlift\u2026"
    });
    const dl = this._createDatalist(
      labelWrap,
      `dl-ex-${Date.now()}`,
      history.getExercises()
    );
    input.setAttribute("list", dl.id);
    input.value = "Running";
    this.labelValue = input.value;
    const dynWrap = form.createDiv({ cls: "life-os-exercise-fields" });
    const rebuild = () => {
      dynWrap.empty();
      this.values.clear();
      const exName = input.value.trim();
      const config = EXERCISE_CONFIG[exName] || ["sets", "reps", "load"];
      const lastMetrics = history.getExerciseLastMetrics(exName) || {};
      const labels = {
        sets: "Sets",
        reps: "Reps per set",
        sec: "Seconds per set",
        km: "Distance (km)",
        min: "Duration (min)",
        load: "Weight / Load (kg)"
      };
      for (const field of config) {
        const row = dynWrap.createDiv({ cls: "life-os-field" });
        const lastVal = lastMetrics[field] ? ` (Last: ${lastMetrics[field]})` : "";
        row.createEl("label", { text: `${labels[field] || field}${lastVal}` });
        const inp = row.createEl("input", {
          type: "number",
          placeholder: lastMetrics[field] ? String(lastMetrics[field]) : "Value"
        });
        inp.min = "0";
        inp.step = field === "km" || field === "load" ? "0.1" : "1";
        if (lastMetrics[field]) {
          inp.value = String(lastMetrics[field]);
          this.values.set(field, inp.value);
        }
        inp.oninput = () => this.values.set(field, inp.value);
      }
    };
    input.oninput = () => {
      this.labelValue = input.value.trim();
    };
    input.onchange = () => {
      this.labelValue = input.value.trim();
      rebuild();
    };
    rebuild();
    this._buildOptionalNote(form);
  }
  _buildReadingForm(form) {
    const history = this.plugin.store.history;
    const labelWrap = form.createDiv({ cls: "life-os-field" });
    labelWrap.createEl("label", { text: "Book / Reading Title (Choose past or type new)" });
    const input = labelWrap.createEl("input", {
      type: "text",
      placeholder: "e.g. Atomic Habits, Deep Work, Paper Title\u2026"
    });
    const dl = this._createDatalist(
      labelWrap,
      `dl-reading-${Date.now()}`,
      history.getReadingTitles()
    );
    input.setAttribute("list", dl.id);
    input.oninput = () => {
      this.labelValue = input.value.trim();
    };
    const mwrap = form.createDiv({ cls: "life-os-field" });
    mwrap.createEl("label", { text: "Reading Duration" });
    this._minutes = buildMinutesWidget(mwrap, 20, { step: 10 });
    this._buildOptionalNote(form);
  }
  _buildScreenForm(form) {
    const history = this.plugin.store.history;
    const labelWrap = form.createDiv({ cls: "life-os-field" });
    labelWrap.createEl("label", { text: "Screen Activity / Purpose" });
    const input = labelWrap.createEl("input", {
      type: "text",
      placeholder: "e.g. Study, Work, YouTube, Gaming\u2026"
    });
    const dl = this._createDatalist(
      labelWrap,
      `dl-screen-${Date.now()}`,
      history.getScreenCategories()
    );
    input.setAttribute("list", dl.id);
    input.value = "Study";
    this.labelValue = input.value;
    input.oninput = () => {
      this.labelValue = input.value.trim();
    };
    const mwrap = form.createDiv({ cls: "life-os-field" });
    mwrap.createEl("label", { text: "Time Spent" });
    this._minutes = buildMinutesWidget(mwrap, 30, {
      step: this.plugin.settings.screenStep || 15,
      stepOptions: [5, 10, 15, 30, 45, 60],
      persistStep: true,
      plugin: this.plugin
    });
    this._buildOptionalNote(form);
  }
  _buildGenericLogForm(form) {
    const h = this.habit;
    const history = this.plugin.store.history;
    const labelWrap = form.createDiv({ cls: "life-os-field" });
    labelWrap.createEl("label", { text: "Activity / Label (Choose past or type new)" });
    const input = labelWrap.createEl("input", {
      type: "text",
      placeholder: "What did you complete?"
    });
    const suggestions = [
      .../* @__PURE__ */ new Set([...h.suggestions || [], ...history.getHabitLabels(h.id)])
    ];
    const dl = this._createDatalist(
      labelWrap,
      `dl-${h.id}-${Date.now()}`,
      suggestions
    );
    input.setAttribute("list", dl.id);
    input.oninput = () => {
      this.labelValue = input.value.trim();
    };
    const mwrap = form.createDiv({ cls: "life-os-field" });
    mwrap.createEl("label", { text: "Duration" });
    this._minutes = buildMinutesWidget(mwrap, 15, { step: 5 });
    this._buildOptionalNote(form);
  }
  _buildOptionalNote(form) {
    const n = form.createDiv({ cls: "life-os-field" });
    n.createEl("label", { text: "Notes / Details (optional)" });
    const nIn = n.createEl("input", { type: "text", placeholder: "Optional details" });
    nIn.oninput = () => {
      this.noteValue = nIn.value;
    };
  }
  async save() {
    const h = this.habit;
    const fields = /* @__PURE__ */ new Map();
    const history = this.plugin.store.history;
    for (const [key, value] of this.values) {
      if (value !== "" && value != null) fields.set(key, String(value));
    }
    if (this._minutes && this._minutes.get() > 0) {
      fields.set("min", String(this._minutes.get()));
    }
    if (this.noteValue.trim()) {
      fields.set("note", this.noteValue.trim());
    }
    if (h.id === "study") {
      const subject = this.studySubject.trim();
      const topic = this.studyTopic.trim();
      const subtopic = this.studySubtopic.trim();
      if (!subject) {
        new import_obsidian.Notice("Please choose or enter a subject.");
        return;
      }
      if (!topic) {
        new import_obsidian.Notice("Please enter a topic.");
        return;
      }
      if (!this._minutes || this._minutes.get() <= 0) {
        new import_obsidian.Notice("Please specify duration in minutes.");
        return;
      }
      fields.set("subject", subject);
      fields.set("topic", topic);
      if (subtopic) fields.set("subtopic", subtopic);
      this.labelValue = topic;
      history.recordStudyEntry(subject, topic, subtopic);
    } else if (h.id === "exercise") {
      const metrics = Object.fromEntries(fields.entries());
      history.recordExerciseEntry(this.labelValue, metrics);
    } else {
      history.recordHabitLabel(h.id, this.labelValue);
    }
    if (!this.labelValue.trim()) {
      new import_obsidian.Notice("Please enter a label.");
      return;
    }
    try {
      await this.plugin.store.updateDay(this.date, (doc) => {
        addHabitEntry(doc, h.id, h.name, {
          label: this.labelValue || "",
          fields
        });
      });
      new import_obsidian.Notice(`Logged ${h.name}: ${this.labelValue}`);
      this.close();
    } catch (e) {
      new import_obsidian.Notice(`Could not log: ${e.message || e}`);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, date, task, parentTask = null) {
    super(app);
    this.plugin = plugin;
    this.date = date;
    this.task = task;
    this.parentTask = parentTask;
  }
  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", {
      text: this.task ? "Edit Task" : this.parentTask ? "New Subtask" : "New Task"
    });
    await this.plugin.store.history.initHistory();
    const form = contentEl.createDiv({ cls: "life-os-form" });
    const t = this.task || { label: "", fields: /* @__PURE__ */ new Map() };
    let label = t.label;
    const l = form.createDiv({ cls: "life-os-field" });
    l.createEl("label", { text: "Task Title (Choose past or type new)" });
    const lIn = l.createEl("input", {
      type: "text",
      placeholder: "e.g. Finish lab report, Buy groceries, Review flashcards\u2026"
    });
    lIn.value = label;
    const taskDl = l.createEl("datalist");
    taskDl.id = `dl-tasks-${Date.now()}`;
    const suggestions = this.plugin.store.history.getTaskSuggestions();
    for (const item of suggestions) {
      taskDl.createEl("option", { value: item });
    }
    lIn.setAttribute("list", taskDl.id);
    lIn.oninput = () => label = lIn.value;
    const pf = form.createDiv({ cls: "life-os-field" });
    pf.createEl("label", { text: "Priority" });
    const pSel = pf.createEl("select");
    pSel.createEl("option", { value: "", text: "Normal" });
    pSel.createEl("option", { value: "high", text: "\u23EB High" });
    pSel.createEl("option", { value: "medium", text: "\u{1F53C} Medium" });
    pSel.createEl("option", { value: "low", text: "\u{1F53D} Low" });
    pSel.value = t.fields && t.fields.get("priority") || "";
    let dueDate = t.fields && t.fields.get("dueDate") || this.date;
    const df = form.createDiv({ cls: "life-os-field" });
    df.createEl("label", { text: "Due Date (\u{1F4C5})" });
    const dIn = df.createEl("input", { type: "date" });
    dIn.value = dueDate;
    dIn.oninput = () => dueDate = dIn.value;
    let scheduledDate = t.fields && t.fields.get("scheduledDate") || "";
    const sf = form.createDiv({ cls: "life-os-field" });
    sf.createEl("label", { text: "Scheduled Date (\u23F3, optional)" });
    const sIn = sf.createEl("input", { type: "date" });
    sIn.value = scheduledDate;
    sIn.oninput = () => scheduledDate = sIn.value;
    let recurrence = t.fields && t.fields.get("recurrence") || "";
    const rf = form.createDiv({ cls: "life-os-field" });
    rf.createEl("label", { text: "Recurrence (\u{1F501}, e.g. every day, every week)" });
    const rIn = rf.createEl("input", {
      type: "text",
      placeholder: "every day / every week / every 2 weeks"
    });
    rIn.value = recurrence;
    rIn.oninput = () => recurrence = rIn.value;
    const btns = contentEl.createDiv({ cls: "life-os-modal-buttons" });
    if (this.task) {
      btns.createEl("button", { text: "Delete Task", cls: "mod-warning" }).onclick = async () => {
        await this.plugin.store.updateDay(this.date, (doc) => removeTask(doc, this.task.id));
        this.close();
      };
    }
    btns.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    btns.createEl("button", { text: "Save Task", cls: "mod-cta" }).onclick = async () => {
      if (!label.trim()) {
        new import_obsidian.Notice("Task title cannot be empty");
        return;
      }
      const fields = new Map(t.fields || []);
      if (pSel.value) fields.set("priority", pSel.value);
      else fields.delete("priority");
      if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) fields.set("dueDate", dueDate);
      else fields.delete("dueDate");
      if (scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate))
        fields.set("scheduledDate", scheduledDate);
      else fields.delete("scheduledDate");
      if (recurrence.trim()) fields.set("recurrence", recurrence.trim());
      else fields.delete("recurrence");
      this.plugin.store.history.recordTask(label.trim());
      if (this.task) {
        fields.set("id", this.task.id);
        await this.plugin.store.updateDay(
          this.date,
          (doc) => updateTask(doc, this.task.id, { label: label.trim(), fields })
        );
      } else {
        const indent = this.parentTask ? (this.parentTask.indent || 0) + 1 : 0;
        await this.plugin.store.updateDay(
          this.date,
          (doc) => addTask(
            doc,
            label.trim(),
            fields,
            indent,
            this.parentTask && this.parentTask.id
          )
        );
      }
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var BlockEditorModal = class extends import_obsidian.Modal {
  constructor(app, plugin, date, block) {
    super(app);
    this.plugin = plugin;
    this.date = date;
    this.block = block;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    const editing = !!(this.block && this.block.id);
    contentEl.createEl("h2", { text: editing ? "Edit Time Block" : "New Time Block" });
    const form = contentEl.createDiv({ cls: "life-os-form" });
    const b = this.block || { start: 9 * 60, end: 10 * 60, label: "Focus Session", kind: "task" };
    let label = b.label;
    let kind = b.kind || "task";
    let start = b.start;
    let end = b.end;
    const lf = form.createDiv({ cls: "life-os-field" });
    lf.createEl("label", { text: "Block Label" });
    const lIn = lf.createEl("input", { type: "text" });
    lIn.value = label;
    lIn.oninput = () => label = lIn.value;
    const kf = form.createDiv({ cls: "life-os-field" });
    kf.createEl("label", { text: "Category / Kind" });
    const kSel = kf.createEl("select");
    for (const [k, name] of [
      ["task", "Task / Focus"],
      ["study", "Study Session"],
      ["habit", "Habit / Routine"],
      ["workout", "Exercise / Workout"],
      ["free", "Free / Buffer"]
    ]) {
      kSel.createEl("option", { value: k, text: name });
    }
    kSel.value = kind;
    kSel.onchange = () => kind = kSel.value;
    const timeRow = form.createDiv({ cls: "life-os-field-row" });
    const sf = timeRow.createDiv({ cls: "life-os-field" });
    sf.createEl("label", { text: "Start Time" });
    const sIn = sf.createEl("input", { type: "time" });
    sIn.value = minutesToHHMM(start);
    sIn.oninput = () => start = hhmmToMinutes(sIn.value);
    const ef = timeRow.createDiv({ cls: "life-os-field" });
    ef.createEl("label", { text: "End Time" });
    const eIn = ef.createEl("input", { type: "time" });
    eIn.value = minutesToHHMM(end);
    eIn.oninput = () => end = hhmmToMinutes(eIn.value);
    const btns = contentEl.createDiv({ cls: "life-os-modal-buttons" });
    if (editing) {
      btns.createEl("button", { text: "Delete Block", cls: "mod-warning" }).onclick = async () => {
        await this.plugin.store.updateDay(this.date, (doc) => {
          const s = doc._byName.get("Timeline");
          s.dirty = true;
          s.parsed = s.parsed.filter(
            (x) => !(x.id === this.block.id && x.start === this.block.start)
          );
        });
        this.close();
      };
    }
    btns.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    btns.createEl("button", { text: "Save Block", cls: "mod-cta" }).onclick = async () => {
      if (end <= start) {
        new import_obsidian.Notice("End time must be after start time");
        return;
      }
      const fields = /* @__PURE__ */ new Map([["kind", kind]]);
      const nb = {
        start,
        end,
        label: label.trim() || "Focus",
        fields,
        kind,
        checked: editing ? !!this.block.checked : false,
        id: `${start}-${end}-${label.trim()}`
      };
      await this.plugin.store.updateDay(this.date, (doc) => {
        const s = doc._byName.get("Timeline");
        s.dirty = true;
        const list = s.parsed.slice();
        const idx = editing ? list.findIndex((x) => x.id === this.block.id && x.start === this.block.start) : -1;
        if (idx >= 0) list[idx] = nb;
        else list.push(nb);
        list.sort((a, b2) => a.start - b2.start);
        s.parsed = list;
      });
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HabitEditorModal = class extends import_obsidian.Modal {
  constructor(app, plugin, habit, onDone, isNew = false) {
    super(app);
    this.plugin = plugin;
    this.habit = {
      ...habit,
      items: [...habit.items || []],
      suggestions: [...habit.suggestions || []]
    };
    this.onDone = onDone;
    this.isNew = isNew;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: this.isNew ? "Create Habit" : "Edit Habit" });
    const h = this.habit;
    new import_obsidian.Setting(contentEl).setName("Habit Name").addText((t) => t.setValue(h.name).onChange((v) => h.name = v));
    new import_obsidian.Setting(contentEl).setName("Evaluation Type").setDesc("How this habit is tracked").addDropdown((d) => {
      d.addOption("log", "Log Entries (duration/notes)");
      d.addOption("amount", "Numeric Counter (target count/volume)");
      d.addOption("checklist", "Checklist (multiple sub-items)");
      d.addOption("levels", "Completion Levels (Partial / Full)");
      d.setValue(h.measure).onChange((v) => h.measure = v);
    });
    new import_obsidian.Setting(contentEl).setName("Target Goal (optional)").setDesc("Goal number (e.g. 8 for glasses, 60 for minutes)").addText(
      (t) => t.setValue(h.target && h.target.value != null ? String(h.target.value) : "").onChange((v) => {
        if (!h.target) h.target = { value: 0, unit: "" };
        h.target.value = Number(v) || 0;
      })
    );
    new import_obsidian.Setting(contentEl).setName("Unit").setDesc("e.g. glass, min, km, pages").addText(
      (t) => t.setValue(h.unit || "").onChange((v) => h.unit = v.trim() || void 0)
    );
    new import_obsidian.Setting(contentEl).setName("Checklist Items (comma-separated)").setDesc("For checklist evaluation").addText(
      (t) => t.setValue((h.items || []).join(", ")).onChange((v) => h.items = v.split(",").map((s) => s.trim()).filter(Boolean))
    );
    const btns = contentEl.createDiv({ cls: "life-os-modal-buttons" });
    btns.createEl("button", { text: "Cancel" }).onclick = () => this.close();
    btns.createEl("button", { text: "Save Habit", cls: "mod-cta" }).onclick = async () => {
      const list = this.plugin.settings.habits;
      const idx = list.findIndex((x) => x.id === h.id);
      if (idx >= 0) list[idx] = h;
      else list.push(h);
      await this.plugin.saveSettings();
      if (this.onDone) this.onDone();
      this.close();
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/settings.js
var DEFAULT_SETTINGS = {
  daysFolder: "Life OS/Days",
  goalsFolder: "Life OS/Goals",
  reviewsFolder: "Life OS/Reviews",
  mode: "simple",
  screenStep: 5,
  waterUnit: "glass",
  timeline: {
    snapStep: 15,
    blockSize: 30,
    dayStart: 0,
    quietStart: "23:00",
    quietEnd: "06:00",
    prayerBlockLength: 20
  },
  prayer: {
    latitude: 24.7472,
    longitude: 90.4203,
    method: "Karachi",
    madhab: "hanafi",
    adjustments: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
    manualTimes: { Fajr: "", Sunrise: "", Dhuhr: "", Asr: "", Maghrib: "", Isha: "" },
    scheduleOverrides: {}
  },
  habits: DEFAULT_HABITS,
  glassmorphism: true
};
var LifeOSSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    containerEl.createEl("h2", { text: "Life OS \xB7 Settings" });
    containerEl.createEl("h3", { text: "Storage Folders" });
    new import_obsidian2.Setting(containerEl).setName("Daily Notes Folder").addText(
      (t) => t.setValue(s.daysFolder).onChange(async (v) => {
        s.daysFolder = v.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Reviews Folder").addText(
      (t) => t.setValue(s.reviewsFolder).onChange(async (v) => {
        s.reviewsFolder = v.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Appearance & UI Styling" });
    new import_obsidian2.Setting(containerEl)
      .setName("Frosted Glassmorphism & Material 3")
      .setDesc("Apply translucent frosted glass panels, backdrop blurs, luminous borders, and fluid cockpit responsiveness.")
      .addToggle((toggle) => {
        toggle.setValue(s.glassmorphism !== false).onChange(async (v) => {
          s.glassmorphism = v;
          await this.plugin.saveSettings();
          this.plugin.applyThemePreferences();
        });
      });
    containerEl.createEl("h3", { text: "Wellness & Tracking" });
    new import_obsidian2.Setting(containerEl).setName("Screen-Time Stepper Step").setDesc("Default minutes increment for quick logging").addDropdown((d) => {
      [1, 5, 10, 15, 30].forEach((v) => d.addOption(String(v), `${v} min`));
      d.setValue(String(s.screenStep || 5)).onChange(async (v) => {
        s.screenStep = Number(v);
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Timeline & Calendar" });
    new import_obsidian2.Setting(containerEl).setName("Snap Step").addDropdown((d) => {
      [5, 15, 30].forEach((v) => d.addOption(String(v), `${v} min`));
      d.setValue(String(s.timeline.snapStep)).onChange(async (v) => {
        s.timeline.snapStep = Number(v);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Default Block Duration").addDropdown((d) => {
      [15, 30, 45, 60, 90].forEach((v) => d.addOption(String(v), `${v} min`));
      d.setValue(String(s.timeline.blockSize)).onChange(async (v) => {
        s.timeline.blockSize = Number(v);
        await this.plugin.saveSettings();
      });
    });
    containerEl.createEl("h3", { text: "Prayer Calculations & Overrides" });
    new import_obsidian2.Setting(containerEl).setName("Latitude").addText(
      (t) => t.setValue(String(s.prayer.latitude)).onChange(async (v) => {
        s.prayer.latitude = Number(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Longitude").addText(
      (t) => t.setValue(String(s.prayer.longitude)).onChange(async (v) => {
        s.prayer.longitude = Number(v);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Calculation Method").addDropdown((d) => {
      Object.keys(PRAYER_METHODS).forEach((m) => d.addOption(m, m));
      d.setValue(s.prayer.method).onChange(async (v) => {
        s.prayer.method = v;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian2.Setting(containerEl).setName("Madhab").addDropdown(
      (d) => d.addOption("hanafi", "Hanafi (Later Asr)").addOption("shafi", "Shafi / Standard").setValue(s.prayer.madhab).onChange(async (v) => {
        s.prayer.madhab = v;
        await this.plugin.saveSettings();
      })
    );
    const prayerNames = [
      ["Fajr", "fajr"],
      ["Sunrise", "sunrise"],
      ["Dhuhr", "dhuhr"],
      ["Asr", "asr"],
      ["Maghrib", "maghrib"],
      ["Isha", "isha"]
    ];
    for (const [label, key] of prayerNames) {
      new import_obsidian2.Setting(containerEl).setName(`${label} Saved Manual Time`).setDesc("Overrides calculation when set (leave blank to calculate)").addText((t) => {
        t.inputEl.type = "time";
        t.setValue(String(s.prayer.manualTimes[label] || ""));
        t.onChange(async (v) => {
          s.prayer.manualTimes[label] = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : "";
          await this.plugin.saveSettings();
          await writeTimesToDay(this.plugin, todayKey());
        });
      });
      new import_obsidian2.Setting(containerEl).setName(`${label} Offset (\xB1 minutes)`).addButton(
        (b) => b.setButtonText("\u22125").onClick(async () => {
          s.prayer.adjustments[key] = (Number(s.prayer.adjustments[key]) || 0) - 5;
          await this.plugin.saveSettings();
          await writeTimesToDay(this.plugin, todayKey());
          this.display();
        })
      ).addText(
        (t) => t.setValue(String(s.prayer.adjustments[key] || 0)).onChange(async (v) => {
          s.prayer.adjustments[key] = Number(v) || 0;
          await this.plugin.saveSettings();
          await writeTimesToDay(this.plugin, todayKey());
        })
      ).addButton(
        (b) => b.setButtonText("+5").onClick(async () => {
          s.prayer.adjustments[key] = (Number(s.prayer.adjustments[key]) || 0) + 5;
          await this.plugin.saveSettings();
          await writeTimesToDay(this.plugin, todayKey());
          this.display();
        })
      );
    }
    containerEl.createEl("h3", { text: "Habits Manager" });
    for (const habit of s.habits) {
      new import_obsidian2.Setting(containerEl).setName(habit.name).setDesc(`Measure: ${habit.measure}`).addToggle(
        (t) => t.setValue(habit.enabled).onChange(async (v) => {
          habit.enabled = v;
          await this.plugin.saveSettings();
        })
      ).addButton(
        (b) => b.setButtonText("Edit").onClick(() => {
          new HabitEditorModal(this.app, this.plugin, habit, () => this.display()).open();
        })
      ).addButton(
        (b) => b.setButtonText("Delete").setWarning().onClick(async () => {
          s.habits = s.habits.filter((x) => x.id !== habit.id);
          await this.plugin.saveSettings();
          this.display();
        })
      );
    }
    new import_obsidian2.Setting(containerEl).addButton(
      (b) => b.setButtonText("+ Add Habit").setCta().onClick(() => {
        const h = {
          id: `habit-${Date.now()}`,
          name: "New Habit",
          measure: "log",
          enabled: true,
          fields: { simple: ["min"], advanced: ["min", "note"] }
        };
        new HabitEditorModal(this.app, this.plugin, h, () => this.display(), true).open();
      })
    );
  }
};

// src/core/store.js
var import_obsidian3 = require("obsidian");

// src/core/writequeue.js
var WriteQueue = class {
  constructor() {
    this.tails = /* @__PURE__ */ new Map();
  }
  run(key, task) {
    const prev = this.tails.get(key) || Promise.resolve();
    const next = prev.catch(() => {
    }).then(task);
    this.tails.set(key, next);
    next.finally(() => {
      if (this.tails.get(key) === next) {
        this.tails.delete(key);
      }
    });
    return next;
  }
};

// src/core/events.js
var Events = class {
  constructor() {
    this._m = /* @__PURE__ */ new Map();
  }
  on(name, fn) {
    if (!this._m.has(name)) this._m.set(name, /* @__PURE__ */ new Set());
    this._m.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    this._m.get(name)?.delete(fn);
  }
  emit(name, ...args) {
    const set = this._m.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(...args);
      } catch (e) {
        console.error("Life OS event error", e);
      }
    }
  }
};

// src/core/history.js
var HistoryService = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.cache = {
      studySubjects: new Set(STUDY_SUBJECTS),
      studyTopics: /* @__PURE__ */ new Map(),
      // subject -> Set of topics
      studySubtopics: /* @__PURE__ */ new Map(),
      // topic -> Set of subtopics
      exercises: new Set(Object.keys(EXERCISE_CONFIG)),
      exerciseLastMetrics: /* @__PURE__ */ new Map(),
      // exercise name -> { sets, reps, km, min, load, sec }
      screenCategories: new Set(SCREEN_TYPES),
      readingTitles: /* @__PURE__ */ new Set(["Book", "Article", "Research Paper", "Quran"]),
      habitLabels: /* @__PURE__ */ new Map(),
      // habitId -> Set of labels
      taskLabels: /* @__PURE__ */ new Set()
    };
    this._initialized = false;
  }
  /**
   * Asynchronously indexes past daily notes in small batches on idle,
   * avoiding main-thread lockups.
   */
  async initHistory() {
    if (this._initialized) return;
    this._initialized = true;
    try {
      const folder = `${this.settings.daysFolder}/`;
      const files = this.app.vault.getFiles().filter(
        (f) => f.path.startsWith(folder) && /^\d{4}-\d{2}-\d{2}\.md$/.test(f.path.slice(folder.length))
      ).sort((a, b) => b.basename.localeCompare(a.basename)).slice(0, 90);
      for (let i = 0; i < files.length; i += 10) {
        const chunk = files.slice(i, i + 10);
        await Promise.all(
          chunk.map(async (file) => {
            try {
              const text = await this.app.vault.cachedRead(file);
              const doc = parseDay(text);
              if (!doc || !doc.ok) return;
              this.indexDoc(doc);
            } catch (_) {
            }
          })
        );
        await new Promise((r) => setTimeout(r, 10));
      }
    } catch (e) {
      console.warn("Life OS: Could not index history", e);
    }
  }
  /**
   * Indexes a parsed daily note into in-memory cache.
   */
  indexDoc(doc) {
    const hSec = doc._byName?.get("Habits");
    if (hSec && hSec.parsed) {
      for (const group of hSec.parsed) {
        if (!this.cache.habitLabels.has(group.id)) {
          this.cache.habitLabels.set(group.id, /* @__PURE__ */ new Set());
        }
        const labelSet = this.cache.habitLabels.get(group.id);
        for (const entry of group.entries) {
          if (entry.unknown) continue;
          if (entry.label) labelSet.add(entry.label);
          if (group.id === "study") {
            const subj = entry.fields.get("subject") || "General";
            const topic = entry.fields.get("topic") || entry.label;
            const subtopic = entry.fields.get("subtopic");
            if (subj) this.cache.studySubjects.add(subj);
            if (subj && topic) {
              if (!this.cache.studyTopics.has(subj)) {
                this.cache.studyTopics.set(subj, /* @__PURE__ */ new Set());
              }
              this.cache.studyTopics.get(subj).add(topic);
            }
            if (topic && subtopic) {
              if (!this.cache.studySubtopics.has(topic)) {
                this.cache.studySubtopics.set(topic, /* @__PURE__ */ new Set());
              }
              this.cache.studySubtopics.get(topic).add(subtopic);
            }
          } else if (group.id === "exercise") {
            const exName = entry.label;
            if (exName) {
              this.cache.exercises.add(exName);
              if (!this.cache.exerciseLastMetrics.has(exName)) {
                const metrics = {};
                for (const k of ["sets", "reps", "km", "min", "load", "sec"]) {
                  if (entry.fields.has(k)) metrics[k] = entry.fields.get(k);
                }
                this.cache.exerciseLastMetrics.set(exName, metrics);
              }
            }
          } else if (group.id === "screen") {
            if (entry.label) this.cache.screenCategories.add(entry.label);
          } else if (group.id === "reading") {
            if (entry.label) this.cache.readingTitles.add(entry.label);
          }
        }
      }
    }
    const tSec = doc._byName?.get("Tasks");
    if (tSec && tSec.parsed) {
      for (const t of tSec.parsed) {
        if (t.label) this.cache.taskLabels.add(t.label);
      }
    }
  }
  // Study lookups
  getStudySubjects() {
    return Array.from(this.cache.studySubjects);
  }
  getStudyTopics(subject = "") {
    if (subject && this.cache.studyTopics.has(subject)) {
      return Array.from(this.cache.studyTopics.get(subject));
    }
    const all = /* @__PURE__ */ new Set();
    for (const topics of this.cache.studyTopics.values()) {
      for (const t of topics) all.add(t);
    }
    return Array.from(all);
  }
  getStudySubtopics(topic = "") {
    if (topic && this.cache.studySubtopics.has(topic)) {
      return Array.from(this.cache.studySubtopics.get(topic));
    }
    return [];
  }
  // Exercise lookups
  getExercises() {
    return Array.from(this.cache.exercises);
  }
  getExerciseLastMetrics(name) {
    return this.cache.exerciseLastMetrics.get(name) || null;
  }
  // Screen categories
  getScreenCategories() {
    return Array.from(this.cache.screenCategories);
  }
  // Reading titles
  getReadingTitles() {
    return Array.from(this.cache.readingTitles);
  }
  // Generic Habit labels
  getHabitLabels(habitId) {
    if (habitId === "study") return this.getStudyTopics();
    if (habitId === "exercise") return this.getExercises();
    if (habitId === "screen") return this.getScreenCategories();
    if (habitId === "reading") return this.getReadingTitles();
    const set = this.cache.habitLabels.get(habitId);
    return set ? Array.from(set) : [];
  }
  // Tasks
  getTaskSuggestions() {
    return Array.from(this.cache.taskLabels);
  }
  // Dynamic record additions (when user logs a new entry)
  recordStudyEntry(subject, topic, subtopic = "") {
    if (subject) this.cache.studySubjects.add(subject);
    if (subject && topic) {
      if (!this.cache.studyTopics.has(subject)) {
        this.cache.studyTopics.set(subject, /* @__PURE__ */ new Set());
      }
      this.cache.studyTopics.get(subject).add(topic);
    }
    if (topic && subtopic) {
      if (!this.cache.studySubtopics.has(topic)) {
        this.cache.studySubtopics.set(topic, /* @__PURE__ */ new Set());
      }
      this.cache.studySubtopics.get(topic).add(subtopic);
    }
  }
  recordExerciseEntry(name, metrics = {}) {
    if (name) {
      this.cache.exercises.add(name);
      this.cache.exerciseLastMetrics.set(name, metrics);
    }
  }
  recordHabitLabel(habitId, label) {
    if (!label) return;
    if (!this.cache.habitLabels.has(habitId)) {
      this.cache.habitLabels.set(habitId, /* @__PURE__ */ new Set());
    }
    this.cache.habitLabels.get(habitId).add(label);
  }
  recordTask(label) {
    if (label) this.cache.taskLabels.add(label);
  }
};

// src/core/store.js
var Store = class {
  constructor(app, settings) {
    this.app = app;
    this.settings = settings;
    this.cache = /* @__PURE__ */ new Map();
    this.queue = new WriteQueue();
    this.events = new Events();
    this.history = new HistoryService(app, settings);
    this._recentSelfWrites = /* @__PURE__ */ new Map();
  }
  path(date) {
    return (0, import_obsidian3.normalizePath)(`${this.settings.daysFolder}/${date}.md`);
  }
  async getDay(date) {
    const path = this.path(date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof import_obsidian3.TFile)) return null;
    const hit = this.cache.get(date);
    if (hit && hit.mtime === file.stat.mtime) {
      return hit.doc;
    }
    const text = await this.app.vault.cachedRead(file);
    const doc = parseDay(text);
    this.cache.set(date, { mtime: file.stat.mtime, doc });
    return doc;
  }
  async ensureDayFile(date) {
    const path = this.path(date);
    let file = this.app.vault.getAbstractFileByPath(path);
    if (file instanceof import_obsidian3.TFile) return file;
    await this.ensureFolder(this.settings.daysFolder);
    const text = newDayText(date, this.settings);
    return await this.app.vault.create(path, text);
  }
  async ensureFolder(folder) {
    const parts = (0, import_obsidian3.normalizePath)(folder).split("/");
    let cur = "";
    for (const p of parts) {
      cur = cur ? `${cur}/${p}` : p;
      if (!this.app.vault.getAbstractFileByPath(cur)) {
        try {
          await this.app.vault.createFolder(cur);
        } catch (e) {
        }
      }
    }
  }
  async updateDay(date, mutate) {
    const file = await this.ensureDayFile(date);
    this._recentSelfWrites.set(file.path, Date.now());
    await this.queue.run(
      file.path,
      () => this.app.vault.process(file, (text) => {
        const doc = parseDay(text);
        if (!doc.ok) {
          throw new Error("Life OS: cannot safely edit this note (missing life-os: 2)");
        }
        mutate(doc);
        this.history.indexDoc(doc);
        return serializeDay(doc);
      })
    );
    this.cache.delete(date);
    this.events.emit("day-changed", date);
  }
  invalidate(date) {
    this.cache.delete(date);
    this.events.emit("day-changed", date);
  }
  onExternalChange(file) {
    if (!file || !file.path) return;
    const lastWrite = this._recentSelfWrites.get(file.path);
    if (lastWrite && Date.now() - lastWrite < 1500) {
      return;
    }
    const prefix = (0, import_obsidian3.normalizePath)(this.settings.daysFolder) + "/";
    if (!file.path.startsWith(prefix)) return;
    const base = file.path.slice(prefix.length);
    if (!base.endsWith(".md")) return;
    const date = base.slice(0, -3);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    this.invalidate(date);
  }
};

// src/ui/dashboard-view.js
var import_obsidian4 = require("obsidian");

// src/ui/calendar.js
function renderCalendar(container, plugin, selectedDate, onPick, calMonth) {
  const wrap = container.createDiv({ cls: "life-os-calendar" });
  const head = wrap.createDiv({ cls: "life-os-cal-head" });
  head.createEl("button", { text: "\u2039" }).onclick = () => {
    calMonth.m--;
    if (calMonth.m < 0) {
      calMonth.m = 11;
      calMonth.y--;
    }
    onPick(null);
  };
  head.createEl("span", {
    cls: "title",
    text: monthName(new Date(calMonth.y, calMonth.m, 1))
  });
  head.createEl("button", { text: "\u203A" }).onclick = () => {
    calMonth.m++;
    if (calMonth.m > 11) {
      calMonth.m = 0;
      calMonth.y++;
    }
    onPick(null);
  };
  const grid = wrap.createDiv({ cls: "life-os-cal-grid" });
  for (const d of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) {
    grid.createDiv({ cls: "life-os-cal-dow", text: d });
  }
  const weeks = monthGrid(calMonth.y, calMonth.m);
  const today = todayKey();
  for (const week of weeks) {
    for (const cell of week) {
      if (!cell) {
        grid.createEl("div", { cls: "life-os-cal-day is-other" });
        continue;
      }
      const key = todayKey(cell);
      const el = grid.createEl("button", {
        cls: "life-os-cal-day",
        text: String(cell.getDate())
      });
      el.type = "button";
      const hasNote = !!plugin.app.vault.getAbstractFileByPath(plugin.store.path(key));
      el.setAttribute("aria-label", `${key}${hasNote ? ", note exists" : ""}`);
      el.title = hasNote ? `${key} \xB7 note exists` : key;
      if (hasNote) el.addClass("has-note");
      if (key === today) el.addClass("is-today");
      if (key === selectedDate) el.addClass("is-selected");
      if (hasNote) el.createSpan({ cls: "dot" });
      el.onclick = () => onPick(key);
    }
  }
}

// src/ui/dashboard-view.js
var DASHBOARD_VIEW_TYPE = "life-os-dashboard";
var MOOD_OPTIONS = [
  ["", "\u2014 Mood \u2014"],
  ["5", "\u26A1 5 \xB7 Peak / Joyful"],
  ["4", "\u{1F642} 4 \xB7 Good / Content"],
  ["3", "\u{1F610} 3 \xB7 Neutral / Fine"],
  ["2", "\u{1F971} 2 \xB7 Low / Tired"],
  ["1", "\u{1F62B} 1 \xB7 Very Low / Stressed"]
];
var ENERGY_OPTIONS = [
  ["", "\u2014 Energy \u2014"],
  ["5", "\u26A1 5 \xB7 Maximum Focus"],
  ["4", "\u{1F50B} 4 \xB7 High Energy"],
  ["3", "\u2696\uFE0F 3 \xB7 Steady / OK"],
  ["2", "\u{1F4C9} 2 \xB7 Sluggish / Low"],
  ["1", "\u{1FAAB} 1 \xB7 Exhausted"]
];
var PRAYER_STATUS_LABELS = {
  "": "Not Set",
  done: "Prayed",
  jamaah: "Jama'ah",
  late: "Late",
  missed: "Missed"
};
function get15MinTimeOptions(isBedtime = false) {
  const options = [["", "\u2014:\u2014"]];
  const startMinute = isBedtime ? 20 * 60 : 5 * 60;
  for (let i = 0; i < 96; i++) {
    const m = (startMinute + i * 15) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const hhmm = `${hh}:${mm}`;
    const hour12 = Math.floor(m / 60) % 12 || 12;
    const ampm = Math.floor(m / 60) >= 12 ? "PM" : "AM";
    const label = `${hhmm} (${hour12}:${mm} ${ampm})`;
    options.push([hhmm, label]);
  }
  return options;
}
var DashboardView = class extends import_obsidian4.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.date = todayKey();
    this.calOpen = false;
    const t = parseKey(todayKey());
    this.calMonth = { y: t.getFullYear(), m: t.getMonth() };
    this._unsub = null;
    this._timer = null;
    this._renderPending = false;
  }
  getViewType() {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "Life OS \xB7 Cockpit";
  }
  getIcon() {
    return "layout-dashboard";
  }
  async onOpen() {
    this.plugin.store.history.initHistory();
    this._unsub = this.plugin.store.events.on("day-changed", (d) => {
      if (d === this.date) {
        this.requestRender();
      }
    });
    this._timer = setInterval(() => {
      this.updateCountdownBadge();
    }, 6e4);
    await this.render();
  }
  async onClose() {
    if (this._unsub) this._unsub();
    if (this._timer) clearInterval(this._timer);
  }
  selectDate(date) {
    this.date = date;
    const selected = parseKey(date);
    this.calMonth = { y: selected.getFullYear(), m: selected.getMonth() };
    this.render();
  }
  /**
   * Schedules a render on the next animation frame, coalescing rapid events.
   */
  requestRender() {
    if (this._renderPending) return;
    this._renderPending = true;
    requestAnimationFrame(async () => {
      this._renderPending = false;
      await this.render();
    });
  }
  updateCountdownBadge() {
    const badge = this.contentEl.querySelector(".life-os-prayer-countdown");
    if (!badge) return;
    const times = computePrayerTimes(
      this.date,
      this.plugin.settings.prayer || this.plugin.settings
    );
    const next = getNextPrayer(times);
    badge.textContent = `Next: ${next.name} in ${next.countdown}`;
  }
  async render() {
    const scrollY = this.contentEl.scrollTop;
    const root = this.contentEl;
    root.empty();
    root.addClass("life-os-root");
    this.renderHeader(root);
    if (this.calOpen) {
      renderCalendar(
        root,
        this.plugin,
        this.date,
        (picked) => {
          if (picked) this.selectDate(picked);
          else this.render();
        },
        this.calMonth
      );
    }
    const doc = await this.plugin.store.getDay(this.date);
    if (!doc) {
      const empty = root.createDiv({ cls: "life-os-empty-state" });
      empty.createEl("p", { text: `No daily note found for ${this.date}.` });
      empty.createEl("button", { text: "Create Day Note", cls: "mod-cta" }).onclick = async () => {
        await this.plugin.store.ensureDayFile(this.date);
        await writeTimesToDay(this.plugin, this.date);
        this.render();
      };
      return;
    }
    if (!doc.ok) {
      root.createDiv({
        cls: "life-os-alert-warning",
        text: "This note does not have the 'life-os: 2' schema header. Life OS will not overwrite it."
      });
      return;
    }
    this.renderWellnessBarometer(root, doc);
    this.renderPrayerStrip(root, doc);
    this.renderHabitsSection(root, doc);
    const splitRow = root.createDiv({ cls: "life-os-cockpit-split" });
    await this.renderTimelinePane(splitRow, doc);
    this.renderTasksPane(splitRow, doc);
    this.renderReflectionSection(root, doc);
    this.contentEl.scrollTop = scrollY;
  }
  renderHeader(root) {
    const bar = root.createDiv({ cls: "life-os-datebar" });
    const navGroup = bar.createDiv({ cls: "life-os-date-nav" });
    navGroup.createEl("button", { text: "\u2039", cls: "life-os-nav-arrow" }).onclick = () => this.selectDate(addDays(this.date, -1));
    const dateTitle = navGroup.createEl("span", {
      cls: "life-os-date-title",
      text: humanDate(this.date)
    });
    dateTitle.onclick = () => {
      this.calOpen = !this.calOpen;
      this.render();
    };
    navGroup.createEl("button", { text: "\u203A", cls: "life-os-nav-arrow" }).onclick = () => this.selectDate(addDays(this.date, 1));
    if (this.date !== todayKey()) {
      bar.createEl("button", { text: "Today", cls: "life-os-badge-today" }).onclick = () => this.selectDate(todayKey());
    }
    const actions = bar.createDiv({ cls: "life-os-datebar-actions" });
    actions.createEl("button", {
      text: this.calOpen ? "\u25BE Calendar" : "\u25B8 Calendar",
      cls: "life-os-btn-subtle"
    }).onclick = () => {
      this.calOpen = !this.calOpen;
      this.render();
    };
    actions.createEl("button", {
      text: "+ Quick Log",
      cls: "life-os-btn-primary"
    }).onclick = () => {
      new HabitPickerModal(
        this.app,
        this.plugin,
        (h) => new LogEntryModal(this.app, this.plugin, h, this.date).open()
      ).open();
    };
  }
  renderWellnessBarometer(root, doc) {
    const card = root.createDiv({ cls: "life-os-card life-os-wellness-card" });
    const row = card.createDiv({ cls: "life-os-wellness-row" });
    const sleepBox = row.createDiv({ cls: "life-os-metric-box life-os-sleep-box" });
    const sleepHeader = sleepBox.createDiv({ cls: "life-os-metric-header" });
    sleepHeader.createDiv({ cls: "life-os-metric-label", text: "Sleep (15m Blocks)" });
    const currentSleep = doc.meta.sleep ? Number(doc.meta.sleep) : null;
    const hoursBadge = sleepHeader.createEl("span", {
      cls: "life-os-metric-badge",
      text: currentSleep !== null ? `${currentSleep}h` : "\u2014"
    });
    const sleepInputWrap = sleepBox.createDiv({ cls: "life-os-sleep-inputs" });
    const bedtimeSelect = sleepInputWrap.createEl("select", {
      cls: "life-os-select-compact life-os-sleep-select"
    });
    for (const [val, label] of get15MinTimeOptions(true)) {
      bedtimeSelect.createEl("option", { value: val, text: label });
    }
    bedtimeSelect.value = doc.meta.bedtime || "";
    sleepInputWrap.createSpan({ text: "\u2192", cls: "life-os-arrow" });
    const waketimeSelect = sleepInputWrap.createEl("select", {
      cls: "life-os-select-compact life-os-sleep-select"
    });
    for (const [val, label] of get15MinTimeOptions(false)) {
      waketimeSelect.createEl("option", { value: val, text: label });
    }
    waketimeSelect.value = doc.meta.waketime || "";
    const sleepAdjustWrap = sleepBox.createDiv({ cls: "life-os-sleep-adjust-row" });
    const decSleepBtn = sleepAdjustWrap.createEl("button", {
      text: "\u221215m",
      cls: "life-os-btn-mini",
      title: "Decrease sleep duration by 15 minutes"
    });
    const incSleepBtn = sleepAdjustWrap.createEl("button", {
      text: "+15m",
      cls: "life-os-btn-mini",
      title: "Increase sleep duration by 15 minutes"
    });
    const updateSleepCalculation = async () => {
      const bt = bedtimeSelect.value;
      const wt = waketimeSelect.value;
      if (bt && wt) {
        const mins = timeDiffMinutes(bt, wt);
        const hours = (Math.round(mins / 60 * 4) / 4).toFixed(2);
        hoursBadge.textContent = `${Number(hours)}h`;
        await this.plugin.store.updateDay(this.date, (d) => {
          setFrontmatterScalar(d, "bedtime", bt);
          setFrontmatterScalar(d, "waketime", wt);
          setFrontmatterScalar(d, "sleep", String(Number(hours)));
        });
      }
    };
    bedtimeSelect.onchange = updateSleepCalculation;
    waketimeSelect.onchange = updateSleepCalculation;
    decSleepBtn.onclick = async () => {
      const cur = currentSleep !== null ? currentSleep : 7;
      const next = Math.max(0, cur - 0.25);
      hoursBadge.textContent = `${next}h`;
      await this.plugin.store.updateDay(this.date, (d) => {
        setFrontmatterScalar(d, "sleep", String(next));
      });
    };
    incSleepBtn.onclick = async () => {
      const cur = currentSleep !== null ? currentSleep : 7;
      const next = cur + 0.25;
      hoursBadge.textContent = `${next}h`;
      await this.plugin.store.updateDay(this.date, (d) => {
        setFrontmatterScalar(d, "sleep", String(next));
      });
    };
    const waterBox = row.createDiv({ cls: "life-os-metric-box life-os-water-box" });
    const waterHabit = this.plugin.settings.habits.find((h) => h.id === "water") || {
      target: { value: 8, unit: "glass" },
      unit: "glass"
    };
    const targetVal = Number(waterHabit.target?.value) || 8;
    const unit = waterHabit.unit || "glass";
    const habitGroup = findHabitGroup(doc, { id: "water", name: "Water" });
    let currentWater = habitGroup ? habitGroup.entries.filter((e) => !e.unknown).reduce((sum, e) => sum + Math.max(0, Number(e.fields.get("count") || 0)), 0) : Number(doc.meta.water) || 0;
    const waterHeader = waterBox.createDiv({ cls: "life-os-metric-header" });
    waterHeader.createDiv({ cls: "life-os-metric-label", text: "Hydration" });
    const targetSelect = waterHeader.createEl("select", { cls: "life-os-small-select" });
    for (const val of [6, 8, 10, 12, 16, 2e3, 2500, 3e3]) {
      targetSelect.createEl("option", {
        value: String(val),
        text: `Goal: ${val} ${val > 100 ? "ml" : unit}`
      });
    }
    targetSelect.value = String(targetVal);
    targetSelect.onchange = async () => {
      waterHabit.target = { value: Number(targetSelect.value), unit };
      await this.plugin.saveSettings();
      this.render();
    };
    const waterControls = waterBox.createDiv({ cls: "life-os-water-controls" });
    const decBtn = waterControls.createEl("button", { text: "\u2212", cls: "life-os-btn-icon" });
    const countDisplay = waterControls.createSpan({
      cls: "life-os-metric-badge",
      text: `${currentWater} / ${targetVal} ${unit}`
    });
    const incBtn = waterControls.createEl("button", { text: "+", cls: "life-os-btn-icon" });
    const setWater = async (nextVal) => {
      const wanted = Math.max(0, nextVal);
      currentWater = wanted;
      countDisplay.textContent = `${wanted} / ${targetVal} ${unit}`;
      await this.plugin.store.updateDay(this.date, (d) => {
        setFrontmatterScalar(d, "water", String(wanted));
        let group = findHabitGroup(d, { id: "water", name: "Water" });
        if (!group) {
          group = ensureHabitGroup(d, "water", "Water");
        }
        group.entries = [
          {
            indent: 0,
            checkbox: wanted >= targetVal ? "x" : " ",
            label: "Water",
            fields: /* @__PURE__ */ new Map([["count", String(wanted)]]),
            raw: ""
          }
        ];
        d._byName.get("Habits").dirty = true;
      });
    };
    decBtn.onclick = () => setWater(currentWater - 1);
    incBtn.onclick = () => setWater(currentWater + 1);
    const moodBox = row.createDiv({ cls: "life-os-metric-box life-os-mood-box" });
    moodBox.createDiv({ cls: "life-os-metric-label", text: "Mood" });
    const mSel = moodBox.createEl("select", { cls: "life-os-select-compact" });
    for (const [val, label] of MOOD_OPTIONS) {
      mSel.createEl("option", { value: val, text: label });
    }
    mSel.value = String(doc.meta.mood || "");
    mSel.onchange = async () => {
      await this.plugin.store.updateDay(
        this.date,
        (d) => setFrontmatterScalar(d, "mood", mSel.value)
      );
    };
    const energyBox = row.createDiv({ cls: "life-os-metric-box life-os-energy-box" });
    energyBox.createDiv({ cls: "life-os-metric-label", text: "Energy" });
    const eSel = energyBox.createEl("select", { cls: "life-os-select-compact" });
    for (const [val, label] of ENERGY_OPTIONS) {
      eSel.createEl("option", { value: val, text: label });
    }
    eSel.value = String(doc.meta.energy || "");
    eSel.onchange = async () => {
      await this.plugin.store.updateDay(
        this.date,
        (d) => setFrontmatterScalar(d, "energy", eSel.value)
      );
    };
  }
  renderPrayerStrip(root, doc) {
    const card = root.createDiv({ cls: "life-os-card life-os-prayer-card" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ cls: "life-os-card-title", text: "Daily Prayers" });
    const times = computePrayerTimes(
      this.date,
      this.plugin.settings.prayer || this.plugin.settings
    );
    const next = getNextPrayer(times);
    header.createDiv({
      cls: "life-os-prayer-countdown",
      text: `Next: ${next.name} in ${next.countdown}`
    });
    const strip = card.createDiv({ cls: "life-os-prayer-strip" });
    const prayers = doc._byName.get("Prayers")?.parsed || [];
    for (const p of prayers) {
      const pItem = strip.createDiv({
        cls: `life-os-prayer-item ${p.status ? "is-" + p.status : ""}`
      });
      pItem.createDiv({ cls: "life-os-prayer-name", text: p.name });
      pItem.createDiv({ cls: "life-os-prayer-time", text: p.time || times[p.name] || "\u2014" });
      const statusSelect = pItem.createEl("select", { cls: "life-os-prayer-status-select" });
      for (const [k, lbl] of Object.entries(PRAYER_STATUS_LABELS)) {
        statusSelect.createEl("option", { value: k, text: lbl });
      }
      statusSelect.value = p.status || "";
      statusSelect.onchange = async () => {
        await this.plugin.store.updateDay(
          this.date,
          (d) => setPrayer(d, p.name, { status: statusSelect.value })
        );
      };
    }
  }
  renderHabitsSection(root, doc) {
    const card = root.createDiv({ cls: "life-os-card life-os-habits-card" });
    const header = card.createDiv({ cls: "life-os-card-header" });
    header.createDiv({ cls: "life-os-card-title", text: "Habits & Routines" });
    const enabled = this.plugin.settings.habits.filter(
      (h) => h.enabled && h.id !== "water"
    );
    const grid = card.createDiv({ cls: "life-os-habits-grid" });
    for (const h of enabled) {
      const g = findHabitGroup(doc, h);
      const entries = g ? g.entries.filter((e) => !e.unknown) : [];
      const status = computeStatus(h, entries);
      const item = grid.createDiv({
        cls: `life-os-habit-chip is-${status}`
      });
      const topRow = item.createDiv({ cls: "life-os-habit-chip-top" });
      topRow.createSpan({ cls: "life-os-habit-name", text: h.name });
      const logBtn = topRow.createEl("button", {
        text: "+",
        cls: "life-os-btn-mini",
        title: `Log ${h.name}`
      });
      logBtn.onclick = (e) => {
        e.stopPropagation();
        new LogEntryModal(this.app, this.plugin, h, this.date).open();
      };
      const summaryText = summarize(h, entries);
      item.createDiv({ cls: "life-os-habit-summary", text: summaryText });
      if (h.measure === "checklist") {
        const checkWrap = item.createDiv({ cls: "life-os-habit-subchecks" });
        const top = entries.filter((e) => e.checkbox !== null && e.indent === 0);
        for (const e of top) {
          const row = checkWrap.createDiv({ cls: "life-os-mini-check" });
          const cb = row.createEl("input", { type: "checkbox" });
          cb.checked = e.checkbox === "x";
          cb.onchange = async () => {
            await this.plugin.store.updateDay(this.date, (d) => {
              const grp = findHabitGroup(d, h);
              if (!grp) return;
              const cand = grp.entries.filter(
                (x) => !x.unknown && x.checkbox !== null && x.indent === 0
              );
              const target = cand[top.indexOf(e)];
              if (target) {
                target.checkbox = cb.checked ? "x" : " ";
                d._byName.get("Habits").dirty = true;
              }
            });
          };
          row.createSpan({ text: e.label });
        }
      }
    }
  }
  async renderTimelinePane(parent, doc) {
    const pane = parent.createDiv({ cls: "life-os-pane life-os-timeline-pane" });
    const head = pane.createDiv({ cls: "life-os-pane-header" });
    head.createDiv({ cls: "life-os-pane-title", text: "Schedule & Timeline" });
    head.createEl("button", {
      text: "+ Block",
      cls: "life-os-btn-mini"
    }).onclick = () => {
      new BlockEditorModal(this.app, this.plugin, this.date, {
        start: 9 * 60,
        end: 10 * 60,
        label: "Focus Block",
        kind: "task",
        fields: /* @__PURE__ */ new Map()
      }).open();
    };
    const blocksList = pane.createDiv({ cls: "life-os-timeline-list" });
    const userBlocks = doc._byName.get("Timeline")?.parsed || [];
    const prayerBlocks = computePrayerBlocks(this.date, this.plugin.settings);
    const allBlocks = [...userBlocks, ...prayerBlocks].sort((a, b) => a.start - b.start);
    if (!allBlocks.length) {
      blocksList.createDiv({ cls: "life-os-empty-note", text: "No time blocks scheduled." });
      return;
    }
    for (const b of allBlocks) {
      const row = blocksList.createDiv({
        cls: `life-os-block-row is-${b.kind} ${b.checked ? "is-done" : ""}`
      });
      if (!b.fixed) {
        const cb = row.createEl("input", { type: "checkbox" });
        cb.checked = !!b.checked;
        cb.onchange = async () => {
          await this.plugin.store.updateDay(this.date, (d) => {
            const list = d._byName.get("Timeline").parsed;
            const target = list.find((x) => x.id === b.id && x.start === b.start);
            if (target) {
              target.checked = cb.checked;
              d._byName.get("Timeline").dirty = true;
            }
          });
        };
      }
      const s = `${String(Math.floor(b.start / 60)).padStart(2, "0")}:${String(
        b.start % 60
      ).padStart(2, "0")}`;
      const e = `${String(Math.floor(b.end / 60)).padStart(2, "0")}:${String(
        b.end % 60
      ).padStart(2, "0")}`;
      row.createSpan({ cls: "life-os-block-time", text: `${s}\u2013${e}` });
      row.createSpan({ cls: "life-os-block-label", text: b.label });
      if (!b.fixed) {
        row.onclick = (ev) => {
          if (ev.target.tagName !== "INPUT") {
            new BlockEditorModal(this.app, this.plugin, this.date, b).open();
          }
        };
      }
    }
  }
  renderTasksPane(parent, doc) {
    const pane = parent.createDiv({ cls: "life-os-pane life-os-tasks-pane" });
    const head = pane.createDiv({ cls: "life-os-pane-header" });
    head.createDiv({ cls: "life-os-pane-title", text: "Tasks & Focus" });
    head.createEl("button", {
      text: "+ Task",
      cls: "life-os-btn-mini"
    }).onclick = () => {
      new TaskModal(this.app, this.plugin, this.date, null).open();
    };
    const taskList = pane.createDiv({ cls: "life-os-tasks-list" });
    const tasks = doc._byName.get("Tasks")?.parsed || [];
    if (!tasks.length) {
      taskList.createDiv({ cls: "life-os-empty-note", text: "No tasks due today." });
      return;
    }
    for (const t of tasks) {
      const row = taskList.createDiv({
        cls: `life-os-task-row ${t.checked ? "is-done" : ""}`
      });
      row.style.paddingLeft = `${(t.indent || 0) * 16 + 8}px`;
      const cb = row.createEl("input", { type: "checkbox" });
      cb.checked = t.checked;
      cb.onchange = async () => {
        await this.plugin.store.updateDay(this.date, (d) => toggleTask(d, t.id));
      };
      const title = row.createSpan({ cls: "life-os-task-title", text: t.label });
      title.onclick = () => new TaskModal(this.app, this.plugin, this.date, t).open();
      const priority = t.fields?.get("priority");
      if (priority === "high") {
        row.createSpan({ cls: "life-os-priority-badge is-high", text: "\u23EB" });
      } else if (priority === "medium") {
        row.createSpan({ cls: "life-os-priority-badge is-medium", text: "\u{1F53C}" });
      } else if (priority === "low") {
        row.createSpan({ cls: "life-os-priority-badge is-low", text: "\u{1F53D}" });
      }
      const due = t.fields?.get("dueDate");
      if (due) {
        row.createSpan({ cls: "life-os-task-due", text: `\u{1F4C5} ${due}` });
      }
    }
  }
  renderReflectionSection(root, doc) {
    const card = root.createDiv({ cls: "life-os-card life-os-reflection-card" });
    const head = card.createDiv({ cls: "life-os-card-header" });
    head.createDiv({ cls: "life-os-card-title", text: "Daily Reflection" });
    const ta = card.createEl("textarea", {
      cls: "life-os-reflection-input",
      placeholder: "Wins, lessons, thoughts, or things to improve tomorrow\u2026"
    });
    ta.value = doc._byName.get("Reflection")?.parsed?.text || "";
    let rt = null;
    ta.oninput = () => {
      clearTimeout(rt);
      rt = setTimeout(async () => {
        await this.plugin.store.updateDay(
          this.date,
          (d) => setReflection(d, ta.value)
        );
      }, 500);
    };
    ta.onblur = async () => {
      if (rt) {
        clearTimeout(rt);
        rt = null;
        await this.plugin.store.updateDay(
          this.date,
          (d) => setReflection(d, ta.value)
        );
      }
    };
  }
};

// src/ui/timeline-view.js
var import_obsidian5 = require("obsidian");

// src/domain/timeline.js
var DAY = 1440;
var snap = (min, step) => Math.round(min / step) * step;
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
function freeWindows(blocks, from = 0, to = DAY) {
  const sorted = blocks.filter((b) => b.end > from && b.start < to).slice().sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.start > cursor) {
      out.push({ start: cursor, end: Math.min(b.start, to) });
    }
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < to) {
    out.push({ start: cursor, end: to });
  }
  return out.filter((w) => w.end > w.start);
}
var sumWindows = (ws) => ws.reduce((a, w) => a + (w.end - w.start), 0);
var largestWindow = (ws) => ws.reduce((m, w) => Math.max(m, w.end - w.start), 0);

// src/ui/timeline-view.js
var TIMELINE_VIEW_TYPE = "life-os-timeline";
var TimelineView = class extends import_obsidian5.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.date = todayKey();
    this.mode = "day";
    const initial = parseKey(this.date);
    this.calMonth = { y: initial.getFullYear(), m: initial.getMonth() };
    this._unsub = null;
  }
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "Life OS \xB7 Timeline";
  }
  getIcon() {
    return "calendar-clock";
  }
  async onOpen() {
    this._unsub = this.plugin.store.events.on("day-changed", (d) => {
      if (d === this.date || this.mode !== "day") this.render();
    });
    this.render();
  }
  async onClose() {
    if (this._unsub) this._unsub();
  }
  async render() {
    const root = this.contentEl;
    root.empty();
    root.addClass("life-os-root");
    const bar = root.createDiv({ cls: "life-os-datebar" });
    const rangeStep = this.mode === "week" ? 7 : this.mode === "agenda" ? 14 : 1;
    const shiftDate = (dir) => {
      if (this.mode === "month") {
        this.calMonth.m += dir;
        if (this.calMonth.m < 0) {
          this.calMonth.m = 11;
          this.calMonth.y--;
        }
        if (this.calMonth.m > 11) {
          this.calMonth.m = 0;
          this.calMonth.y++;
        }
      } else {
        this.date = addDays(this.date, dir * rangeStep);
      }
      this.render();
    };
    bar.createEl("button", { text: "\u2039" }).onclick = () => shiftDate(-1);
    bar.createEl("h2", {
      text: this.mode === "month" ? monthName(new Date(this.calMonth.y, this.calMonth.m, 1)) : humanDate(this.date)
    });
    bar.createEl("button", { text: "\u203A" }).onclick = () => shiftDate(1);
    bar.createEl("button", { text: "Today" }).onclick = () => {
      this.date = todayKey();
      const t = parseKey(this.date);
      this.calMonth = { y: t.getFullYear(), m: t.getMonth() };
      this.render();
    };
    const views = root.createDiv({ cls: "life-os-calendar-views" });
    for (const m of ["day", "week", "month", "agenda"]) {
      const btn = views.createEl("button", { text: m.toUpperCase() });
      if (this.mode === m) btn.addClass("is-active");
      btn.onclick = () => {
        this.mode = m;
        this.render();
      };
    }
    if (this.mode === "month") {
      renderCalendar(
        root,
        this.plugin,
        this.date,
        (picked) => {
          if (picked) {
            this.date = picked;
            this.mode = "day";
          }
          this.render();
        },
        this.calMonth
      );
      return;
    }
    if (this.mode === "week" || this.mode === "agenda") {
      const dates = this.mode === "week" ? weekDates(this.date) : Array.from({ length: 14 }, (_, i) => addDays(this.date, i));
      const listWrap = root.createDiv({ cls: `life-os-calendar-list is-${this.mode}` });
      for (const d of dates) {
        const sec = listWrap.createDiv({ cls: "life-os-calendar-day" });
        const h = sec.createDiv({ cls: "life-os-calendar-day-head" });
        h.createEl("strong", { text: humanDate(d) });
        h.createEl("button", { text: "+ Block", cls: "life-os-btn-mini" }).onclick = () => new BlockEditorModal(this.app, this.plugin, d, {
          start: 9 * 60,
          end: 10 * 60,
          label: "New Block",
          kind: "task",
          fields: /* @__PURE__ */ new Map()
        }).open();
        const doc2 = await this.plugin.store.getDay(d);
        const saved = doc2 && doc2.ok ? doc2._byName.get("Timeline").parsed.slice() : [];
        const blocks = [
          ...saved,
          ...computePrayerBlocks(d, this.plugin.settings)
        ].sort((a, b) => a.start - b.start);
        for (const b of blocks) {
          const item = sec.createEl("button", {
            cls: `life-os-calendar-event is-${b.kind} ${b.checked ? "is-done" : ""}`,
            text: `${minutesToHHMM(b.start)}\u2013${minutesToHHMM(b.end)}  ${b.label || "Block"}`
          });
          if (!b.fixed) {
            item.onclick = () => new BlockEditorModal(this.app, this.plugin, d, b).open();
          }
        }
      }
      return;
    }
    const doc = await this.plugin.store.getDay(this.date);
    if (!doc || !doc.ok) {
      root.createDiv({
        cls: "life-os-empty-state",
        text: "No editable day note found. Return to dashboard to create it."
      });
      return;
    }
    const timeline = doc._byName.get("Timeline").parsed.slice();
    const prayerBlocks = computePrayerBlocks(this.date, this.plugin.settings);
    const all = [...timeline, ...prayerBlocks];
    const info = root.createDiv({ cls: "life-os-timeline-info" });
    const wins = freeWindows(timeline);
    info.createSpan({ text: `Free Time: ${minutesToHHMM(sumWindows(wins))}` });
    info.createSpan({ text: `Largest Window: ${minutesToHHMM(largestWindow(wins))}` });
    const wrap = root.createDiv({ cls: "life-os-timeline-wrap" });
    const hours = wrap.createDiv({ cls: "life-os-timeline-hours" });
    for (let h = 0; h < 24; h++) hours.createDiv({ text: `${pad2(h)}:00` });
    const grid = wrap.createDiv({ cls: "life-os-timeline-grid" });
    const slotH = () => grid.clientHeight / 24;
    const ppm = () => grid.clientHeight / DAY;
    for (const b of all) {
      const el = grid.createDiv({ cls: `life-os-block is-${b.kind}` });
      if (b.checked) el.addClass("is-done");
      el.style.top = `${b.start / 60 * slotH()}px`;
      el.style.height = `${(b.end - b.start) / 60 * slotH()}px`;
      el.createSpan({
        cls: "label",
        text: `${minutesToHHMM(b.start)} ${b.label || ""}`
      });
      if (!b.fixed) {
        el.onclick = () => new BlockEditorModal(this.app, this.plugin, this.date, b).open();
      }
    }
    grid.onclick = (ev) => {
      if (ev.target !== grid) return;
      const y = ev.clientY - grid.getBoundingClientRect().top;
      const step = this.plugin.settings.timeline?.snapStep || 15;
      const size = this.plugin.settings.timeline?.blockSize || 30;
      const start = clamp(snap(y / ppm(), step), 0, DAY - size);
      const end = start + size;
      new BlockEditorModal(this.app, this.plugin, this.date, {
        start,
        end,
        label: "Focus Block",
        kind: "task",
        fields: /* @__PURE__ */ new Map()
      }).open();
    };
    if (this.date === todayKey()) {
      const now = /* @__PURE__ */ new Date();
      const m = now.getHours() * 60 + now.getMinutes();
      const line = grid.createDiv({ cls: "life-os-now" });
      line.style.top = `${m / 60 * slotH()}px`;
    }
  }
};

// src/domain/review.js
var import_obsidian6 = require("obsidian");
async function generateWeeklyReview(plugin, anyDayKey) {
  const wk = weekKey(anyDayKey);
  const dates = weekDates(anyDayKey);
  const lines = [];
  lines.push("---", "life-os: review", `week: ${wk}`, "---", "");
  lines.push(`# Weekly Review \xB7 Week ${wk}`, "");
  const enabled = plugin.settings.habits.filter((h) => h.enabled);
  const perDay = [];
  for (const date of dates) {
    perDay.push({ date, doc: await plugin.store.getDay(date) });
  }
  lines.push("## Habits & Routines");
  for (const h of enabled) {
    const days = [];
    const allEntries = [];
    for (const { date, doc } of perDay) {
      if (!doc || !doc.ok) continue;
      const g = findHabitGroup(doc, h);
      const entries = g ? g.entries.filter((e) => !e.unknown) : [];
      if (entries.length) {
        days.push({ date, entries });
        allEntries.push(...entries);
      }
    }
    if (!days.length) {
      lines.push(`- **${h.name}**: \u2014`);
      continue;
    }
    let detail = "";
    if (h.measure === "log" && h.id !== "exercise") {
      const byLabel = /* @__PURE__ */ new Map();
      for (const e of allEntries) {
        const key = e.label || "(no label)";
        const min = Number(e.fields.get("min") || 0);
        byLabel.set(key, (byLabel.get(key) || 0) + min);
      }
      detail = [...byLabel.entries()].map(([k, v]) => `${k} ${formatMinutes(v)}`).join(", ");
    } else if (h.measure === "log" && h.id === "exercise") {
      const byEx = /* @__PURE__ */ new Map();
      for (const e of allEntries) {
        const key = e.label || "(exercise)";
        byEx.set(key, (byEx.get(key) || 0) + 1);
      }
      detail = [...byEx.entries()].map(([k, v]) => `${k} \xD7${v}`).join(", ");
    } else if (h.measure === "amount") {
      const sum = allEntries.reduce((a, e) => a + Number(e.fields.get("count") || 0), 0);
      detail = `${sum} ${h.unit || "units"}`;
    } else if (h.measure === "checklist") {
      const top = allEntries.filter((e) => e.checkbox !== null && e.indent === 0);
      const done = top.filter((e) => e.checkbox === "x").length;
      detail = `${done}/${top.length} items`;
    } else if (h.measure === "levels") {
      const full = allEntries.filter(
        (e) => String(e.fields.get("level") || "").toLowerCase() === "full"
      ).length;
      const partial = allEntries.filter(
        (e) => String(e.fields.get("level") || "").toLowerCase() === "partial"
      ).length;
      detail = `${full} full, ${partial} partial`;
    }
    const doneDays = days.filter((d) => computeStatus(h, d.entries) === "done").length;
    lines.push(`- **${h.name}**: ${detail} (${doneDays}/${days.length} active days)`);
  }
  lines.push("");
  lines.push("## Prayer Attendance");
  let onTime = 0, jamaah = 0, late = 0, missed = 0;
  for (const { doc } of perDay) {
    if (!doc || !doc.ok) continue;
    const sec = doc._byName.get("Prayers");
    if (!sec || !sec.parsed) continue;
    for (const p of sec.parsed) {
      if (p.status === "jamaah") jamaah++;
      else if (p.status === "done") onTime++;
      else if (p.status === "late") late++;
      else if (p.status === "missed") missed++;
    }
  }
  lines.push(
    `- Prayed in Jama'ah: ${jamaah}`,
    `- Prayed Individually: ${onTime}`,
    `- Late: ${late}`,
    `- Missed: ${missed}`,
    ""
  );
  lines.push("## Wellness & Recovery");
  let totalSleep = 0;
  let loggedSleepCount = 0;
  for (const { date, doc } of perDay) {
    const s = doc && doc.meta ? doc.meta.sleep || "\u2014" : "\u2014";
    const m = doc && doc.meta ? doc.meta.mood || "\u2014" : "\u2014";
    const e = doc && doc.meta ? doc.meta.energy || "\u2014" : "\u2014";
    const w = doc && doc.meta ? doc.meta.water || "\u2014" : "\u2014";
    if (s !== "\u2014" && !isNaN(Number(s))) {
      totalSleep += Number(s);
      loggedSleepCount++;
    }
    lines.push(
      `- ${dayOfWeekName(date)} ${date}: Sleep ${s}h | Mood ${m} | Energy ${e} | Water ${w}`
    );
  }
  if (loggedSleepCount > 0) {
    const avgSleep = (totalSleep / loggedSleepCount).toFixed(1);
    lines.push("", `**Average Sleep:** ${avgSleep}h / night`);
  }
  lines.push("", "## Wins & What Went Well", "", "## Adjustments for Next Week", "");
  await plugin.store.ensureFolder(plugin.settings.reviewsFolder);
  const path = (0, import_obsidian6.normalizePath)(`${plugin.settings.reviewsFolder}/${wk}.md`);
  const existing = plugin.app.vault.getAbstractFileByPath(path);
  const text = lines.join("\n");
  if (existing instanceof import_obsidian6.TFile) {
    await plugin.app.vault.modify(existing, text);
  } else {
    await plugin.app.vault.create(path, text);
  }
  new import_obsidian6.Notice(`Weekly review created: ${wk}`);
  return path;
}

// src/integrations/tasks-bridge.js
var TasksBridge = class {
  constructor(app) {
    this.app = app;
  }
  isTasksEnabled() {
    const enabled = this.app.plugins?.enabledPlugins;
    return !!enabled?.has("obsidian-tasks-plugin");
  }
  getTasksPlugin() {
    return this.app.plugins?.plugins?.["obsidian-tasks-plugin"] || null;
  }
};

// src/integrations/planner-bridge.js
var PlannerBridge = class {
  constructor(app) {
    this.app = app;
  }
  isDayPlannerEnabled() {
    const enabled = this.app.plugins?.enabledPlugins;
    return !!enabled?.has("obsidian-day-planner");
  }
  async openDayPlannerTimeline() {
    const commands = this.app.commands?.listCommands ? this.app.commands.listCommands() : [];
    const command = commands.find(
      (c) => c.id.startsWith("obsidian-day-planner:") && /(?:show|open).*(?:timeline|planner)|(?:timeline|planner).*(?:show|open)/i.test(
        `${c.id} ${c.name}`
      )
    );
    if (command) {
      try {
        this.app.commands.executeCommandById(command.id);
        return true;
      } catch (e) {
        console.warn("Could not execute Day Planner command", e);
      }
    }
    return false;
  }
};

// src/integrations/dataview-bridge.js
var DataviewBridge = class {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
  }
  isDataviewEnabled() {
    const enabled = this.app.plugins?.enabledPlugins;
    return !!enabled?.has("dataview");
  }
  getDataviewAPI() {
    if (!this.isDataviewEnabled()) return null;
    return this.app.plugins?.plugins?.dataview?.api || null;
  }
  async getDaySnapshot(date = todayKey()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) return null;
    const doc = await this.plugin.store.getDay(date);
    if (!doc || !doc.ok) return null;
    const plainFields = (fields) => Object.fromEntries(fields instanceof Map ? fields.entries() : []);
    return {
      date,
      sleep: doc.meta.sleep || "",
      bedtime: doc.meta.bedtime || "",
      waketime: doc.meta.waketime || "",
      water: doc.meta.water || "",
      mood: doc.meta.mood || "",
      energy: doc.meta.energy || "",
      prayers: doc._byName.get("Prayers").parsed.map((p) => ({
        name: p.name,
        time: p.time,
        status: p.status
      })),
      habits: doc._byName.get("Habits").parsed.map((g) => ({
        id: g.id,
        name: g.name,
        entries: g.entries.filter((e) => !e.unknown).map((e) => ({
          label: e.label || "",
          checked: e.checked === true || e.checkbox === "x",
          fields: plainFields(e.fields)
        }))
      })),
      tasks: doc._byName.get("Tasks").parsed.map((t) => ({
        id: t.id,
        label: t.label,
        checked: t.checked,
        indent: t.indent || 0,
        fields: plainFields(t.fields)
      })),
      timeBlocks: doc._byName.get("Timeline").parsed.map((b) => ({
        start: b.start,
        end: b.end,
        label: b.label,
        kind: b.kind,
        checked: !!b.checked,
        fields: plainFields(b.fields)
      })),
      reflection: doc._byName.get("Reflection").parsed.text || ""
    };
  }
};

// src/main.js
var LifeOSPlugin = class extends import_obsidian7.Plugin {
  async onload() {
    await this.loadSettings();
    this.applyThemePreferences();
    this.store = new Store(this.app, this.settings);
    this.tasksBridge = new TasksBridge(this.app);
    this.plannerBridge = new PlannerBridge(this.app);
    this.dataviewBridge = new DataviewBridge(this.app, this);
    this.api = this.createPublicAPI();
    this.registerView(DASHBOARD_VIEW_TYPE, (leaf) => new DashboardView(leaf, this));
    this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new TimelineView(leaf, this));
    this.addRibbonIcon("layout-dashboard", "Open Life OS Cockpit", () => this.openDashboard());
    this.addCommand({
      id: "open-dashboard",
      name: "Open Cockpit Dashboard",
      callback: () => this.openDashboard()
    });
    this.addCommand({
      id: "open-timeline",
      name: "Open Standalone Timeline / Calendar",
      callback: () => this.openTimeline()
    });
    this.addCommand({
      id: "quick-log-habit",
      name: "Quick Log Habit / Activity",
      callback: () => new HabitPickerModal(
        this.app,
        this,
        (h) => new LogEntryModal(this.app, this, h).open()
      ).open()
    });
    this.addCommand({
      id: "quick-add-task",
      name: "Quick Add Daily Task",
      callback: () => new TaskModal(this.app, this, todayKey()).open()
    });
    this.addCommand({
      id: "recalculate-prayers",
      name: "Recalculate Today's Prayer Times",
      callback: async () => {
        const date = todayKey();
        await this.store.ensureDayFile(date);
        await writeTimesToDay(this, date);
        new import_obsidian7.Notice("Today's prayer times updated from settings.");
      }
    });
    this.addCommand({
      id: "generate-weekly-review",
      name: "Generate Weekly Review",
      callback: async () => generateWeeklyReview(this, todayKey())
    });
    this.addSettingTab(new LifeOSSettingTab(this.app, this));
    const onChange = (f) => this.store.onExternalChange(f);
    this.registerEvent(this.app.vault.on("modify", onChange));
    this.registerEvent(this.app.vault.on("create", onChange));
    this.registerEvent(this.app.vault.on("delete", onChange));
    this.registerEvent(this.app.vault.on("rename", onChange));
  }
  onunload() {
    document.body.removeClass("life-os-glassmorphic");
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TIMELINE_VIEW_TYPE);
  }
  applyThemePreferences() {
    if (this.settings.glassmorphism !== false) {
      document.body.addClass("life-os-glassmorphic");
    } else {
      document.body.removeClass("life-os-glassmorphic");
    }
  }
  async openDashboard() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  async openTimeline() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TIMELINE_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  createPublicAPI() {
    return Object.freeze({
      version: 2,
      getDay: (date) => this.dataviewBridge.getDaySnapshot(date),
      onDayChanged: (cb) => this.store.events.on("day-changed", cb),
      openDashboard: () => this.openDashboard(),
      openTimeline: () => this.openTimeline(),
      getDataviewAPI: () => this.dataviewBridge.getDataviewAPI()
    });
  }
  async loadSettings() {
    const raw = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
    this.settings.glassmorphism = raw.glassmorphism !== false;
    this.settings.timeline = Object.assign({}, DEFAULT_SETTINGS.timeline, raw.timeline || {});
    this.settings.prayer = Object.assign({}, DEFAULT_SETTINGS.prayer, raw.prayer || {});
    this.settings.prayer.adjustments = Object.assign(
      {},
      DEFAULT_SETTINGS.prayer.adjustments,
      raw.prayer && raw.prayer.adjustments || {}
    );
    this.settings.prayer.manualTimes = Object.assign(
      {},
      DEFAULT_SETTINGS.prayer.manualTimes,
      raw.prayer && raw.prayer.manualTimes || {}
    );
  }
  async saveSettings() {
    await this.saveData(this.settings);
    if (this.store) {
      this.store.settings = this.settings;
      this.store.events.emit("settings-changed");
    }
  }
};

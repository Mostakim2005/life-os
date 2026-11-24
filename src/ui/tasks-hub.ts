import type { TaskPriority } from "../types";
import { formatDateDMY, todayDMY, toISOKey } from "../core/date-format";
import { getEffectiveDateIso, type VaultTaskEntry } from "../core/vault-task-index";

export type TaskHubBucket = "today" | "upcoming" | "all" | "recurring" | "nodate" | "done";
export type TaskHubScope = "vault" | "daily";
export type TaskHubSort = "due" | "priority" | "file" | "title";
export type TaskHubGroup = "status" | "priority" | "file" | "none";

export interface TasksHubState {
  bucket: TaskHubBucket;
  scope: TaskHubScope;
  sort: TaskHubSort;
  groupBy: TaskHubGroup;
  priorityFilter: TaskPriority | "all";
  tagFilter: string | null;
  searchQuery: string;
}

export function createDefaultTasksHubState(): TasksHubState {
  return {
    bucket: "today",
    scope: "vault",
    sort: "due",
    groupBy: "status",
    priorityFilter: "all",
    tagFilter: null,
    searchQuery: "",
  };
}

export interface TasksHubHost {
  state: TasksHubState;
  onRefresh(): Promise<void>;
  onAddTask(rawInput: string): Promise<void>;
  onToggleTask(entry: VaultTaskEntry): Promise<void>;
  onCyclePriority(entry: VaultTaskEntry): Promise<void>;
  onPostponeTask(entry: VaultTaskEntry): Promise<void>;
  onScheduleTask(entry: VaultTaskEntry): Promise<void>;
  onDeleteTask(entry: VaultTaskEntry): Promise<void>;
  onOpenFile(filePath: string): Promise<void>;
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};

const PRIORITY_LABELS: Record<TaskPriority, { glyph: string; title: string }> = {
  high: { glyph: "⏫ High", title: "High priority (click to cycle)" },
  medium: { glyph: "🔼 Med", title: "Medium priority (click to cycle)" },
  low: { glyph: "🔽 Low", title: "Low priority (click to cycle)" },
  none: { glyph: "·", title: "No priority (click to set High)" },
};

function matchesBucket(
  entry: VaultTaskEntry,
  bucket: TaskHubBucket,
  todayIso: string,
  upcomingEndIso: string
): boolean {
  const t = entry.task;
  const eff = getEffectiveDateIso(t);
  switch (bucket) {
    case "today":
      return !t.done && Boolean(eff) && eff! <= todayIso;
    case "upcoming":
      return !t.done && Boolean(eff) && eff! > todayIso && eff! <= upcomingEndIso;
    case "all":
      return !t.done;
    case "recurring":
      return !t.done && Boolean(t.recurrence);
    case "nodate":
      return !t.done && !eff;
    case "done":
      return t.done;
  }
}

function compareEntries(a: VaultTaskEntry, b: VaultTaskEntry, sort: TaskHubSort): number {
  const effA = getEffectiveDateIso(a.task) ?? "9999-99-99";
  const effB = getEffectiveDateIso(b.task) ?? "9999-99-99";
  const prioA = PRIORITY_RANK[a.task.priority];
  const prioB = PRIORITY_RANK[b.task.priority];

  if (sort === "due") {
    if (effA !== effB) return effA.localeCompare(effB);
    if (prioA !== prioB) return prioA - prioB;
    return a.task.title.localeCompare(b.task.title);
  }
  if (sort === "priority") {
    if (prioA !== prioB) return prioA - prioB;
    if (effA !== effB) return effA.localeCompare(effB);
    return a.task.title.localeCompare(b.task.title);
  }
  if (sort === "file") {
    const fileCmp = a.fileBasename.localeCompare(b.fileBasename);
    if (fileCmp !== 0) return fileCmp;
    return a.lineNumber - b.lineNumber;
  }
  return a.task.title.localeCompare(b.task.title);
}

interface TaskGroup {
  key: string;
  label: string;
  filePath?: string;
  items: VaultTaskEntry[];
}

function buildGroups(
  items: VaultTaskEntry[],
  groupBy: TaskHubGroup,
  todayIso: string
): TaskGroup[] {
  if (groupBy === "none") {
    return items.length > 0 ? [{ key: "all", label: "", items }] : [];
  }

  if (groupBy === "status") {
    const buckets: Record<string, { label: string; items: VaultTaskEntry[] }> = {
      overdue: { label: "Overdue", items: [] },
      today: { label: "Today", items: [] },
      upcoming: { label: "Upcoming", items: [] },
      nodate: { label: "No date", items: [] },
      done: { label: "Completed", items: [] },
    };
    for (const entry of items) {
      if (entry.task.done) {
        buckets.done!.items.push(entry);
        continue;
      }
      const eff = getEffectiveDateIso(entry.task);
      if (!eff) buckets.nodate!.items.push(entry);
      else if (eff < todayIso) buckets.overdue!.items.push(entry);
      else if (eff === todayIso) buckets.today!.items.push(entry);
      else buckets.upcoming!.items.push(entry);
    }
    return Object.entries(buckets)
      .filter(([, g]) => g.items.length > 0)
      .map(([key, g]) => ({ key, label: g.label, items: g.items }));
  }

  if (groupBy === "priority") {
    const order: Array<{ key: TaskPriority; label: string }> = [
      { key: "high", label: "High priority" },
      { key: "medium", label: "Medium priority" },
      { key: "low", label: "Low priority" },
      { key: "none", label: "Normal" },
    ];
    return order
      .map((o) => ({
        key: o.key,
        label: o.label,
        items: items.filter((e) => e.task.priority === o.key),
      }))
      .filter((g) => g.items.length > 0);
  }

  // Group by file
  const map = new Map<string, TaskGroup>();
  for (const entry of items) {
    let grp = map.get(entry.filePath);
    if (!grp) {
      grp = {
        key: entry.filePath,
        label: entry.fileBasename,
        filePath: entry.filePath,
        items: [],
      };
      map.set(entry.filePath, grp);
    }
    grp.items.push(entry);
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function renderTitleWithTagPills(
  parent: HTMLElement,
  title: string,
  activeTag: string | null,
  onTagClick: (tag: string) => void
): void {
  const tagRegex = /(#[\p{L}\p{N}_/-]+)/gu;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(title)) !== null) {
    if (match.index > lastIndex) {
      parent.createSpan({ text: title.slice(lastIndex, match.index) });
    }
    const rawTag = match[1]!;
    const normTag = rawTag.slice(1).toLowerCase();
    const btn = parent.createEl("button", {
      text: rawTag,
      cls: `life-os-th-inline-tag ${activeTag === normTag ? "is-active" : ""}`,
      attr: { type: "button", title: `Filter by ${rawTag}` },
    });
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onTagClick(normTag);
    });
    lastIndex = match.index + rawTag.length;
  }
  if (lastIndex < title.length) {
    parent.createSpan({ text: title.slice(lastIndex) });
  }
}

export function renderTasksHub(
  container: HTMLElement,
  allEntries: VaultTaskEntry[],
  host: TasksHubHost
): void {
  const { state } = host;
  const wrap = container.createDiv({ cls: "life-os-th-wrap" });

  const today = new Date();
  const upcomingEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const todayIso = toISOKey(todayDMY()) ?? "";
  const upcomingEndIso = toISOKey(formatDateDMY(upcomingEnd)) ?? "";

  const scopedEntries =
    state.scope === "daily" ? allEntries.filter((e) => e.isDailyNote) : allEntries;

  // Header strip: title + scope toggle + quick summary
  const header = wrap.createDiv({ cls: "life-os-th-header" });
  const titleSide = header.createDiv({ cls: "life-os-th-title-side" });
  titleSide.createDiv({ text: "Tasks hub", cls: "life-os-th-title" });

  const overdueCount = scopedEntries.filter((e) => {
    const eff = getEffectiveDateIso(e.task);
    return !e.task.done && Boolean(eff) && eff! < todayIso;
  }).length;
  const openCount = scopedEntries.filter((e) => !e.task.done).length;

  const summaryBadge = titleSide.createDiv({ cls: "life-os-th-summary" });
  summaryBadge.createSpan({ text: `${openCount} open` });
  if (overdueCount > 0) {
    summaryBadge.createSpan({
      text: `${overdueCount} overdue`,
      cls: "life-os-th-summary-overdue",
    });
  }

  const rightHeader = header.createDiv({ cls: "life-os-th-scope-wrap" });
  const scopeSeg = rightHeader.createDiv({ cls: "life-os-segmented" });
  const scopes: Array<{ id: TaskHubScope; label: string }> = [
    { id: "vault", label: "Whole vault" },
    { id: "daily", label: "Daily notes" },
  ];
  for (const sc of scopes) {
    const btn = scopeSeg.createEl("button", {
      text: sc.label,
      cls: `life-os-seg-btn ${state.scope === sc.id ? "is-active" : ""}`,
      attr: { type: "button" },
    });
    btn.addEventListener("click", () => {
      if (state.scope !== sc.id) {
        state.scope = sc.id;
        renderTasksHub(replaceWithFreshContainer(wrap), allEntries, host);
      }
    });
  }

  const refreshBtn = rightHeader.createEl("button", {
    text: "Rescan",
    cls: "life-os-btn-subtle",
    attr: { type: "button", title: "Re-scan vault tasks" },
  });
  refreshBtn.addEventListener("click", () => {
    void host.onRefresh();
  });

  // Quick-add natural language bar
  const addBar = wrap.createDiv({ cls: "life-os-th-add-bar" });
  const addInput = addBar.createEl("input", {
    cls: "life-os-input-flex life-os-th-add-input",
    attr: {
      type: "text",
      placeholder: "Quick add task… e.g. Submit report next Friday ⏫ 🔁 every week #work",
    },
  });
  const addBtn = addBar.createEl("button", {
    text: "Add task",
    cls: "life-os-btn-primary",
    attr: { type: "button" },
  });
  const triggerAdd = (): void => {
    const val = addInput.value.trim();
    if (!val) return;
    addInput.value = "";
    void host.onAddTask(val);
  };
  addBtn.addEventListener("click", triggerAdd);
  addInput.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      triggerAdd();
    }
  });

  // Bucket pills row
  const bucketDefs: Array<{ id: TaskHubBucket; label: string }> = [
    { id: "today", label: "Today & overdue" },
    { id: "upcoming", label: "Upcoming (7d)" },
    { id: "all", label: "All open" },
    { id: "recurring", label: "Recurring" },
    { id: "nodate", label: "No date" },
    { id: "done", label: "Completed" },
  ];

  const bucketBar = wrap.createDiv({ cls: "life-os-th-buckets" });
  const bucketButtons = new Map<TaskHubBucket, HTMLButtonElement>();
  for (const b of bucketDefs) {
    const count = scopedEntries.filter((e) =>
      matchesBucket(e, b.id, todayIso, upcomingEndIso)
    ).length;
    const btn = bucketBar.createEl("button", {
      cls: `life-os-th-bucket-btn ${state.bucket === b.id ? "is-active" : ""}`,
      attr: { type: "button" },
    });
    btn.createSpan({ text: b.label });
    btn.createSpan({ text: String(count), cls: "life-os-th-bucket-count" });
    btn.addEventListener("click", () => {
      state.bucket = b.id;
      for (const [id, el] of bucketButtons.entries()) {
        el.toggleClass("is-active", id === b.id);
      }
      renderListContent();
    });
    bucketButtons.set(b.id, btn);
  }

  // Filter / sort / group toolbar
  const toolbar = wrap.createDiv({ cls: "life-os-th-toolbar" });
  const searchInput = toolbar.createEl("input", {
    cls: "life-os-input-flex life-os-th-search",
    attr: { type: "search", placeholder: "Search tasks, #tags, or notes…" },
  });
  searchInput.value = state.searchQuery;
  searchInput.addEventListener("input", () => {
    state.searchQuery = searchInput.value;
    renderListContent();
  });

  const prioSelect = toolbar.createEl("select", { cls: "life-os-select-compact" });
  const prioOpts: Array<{ v: TaskPriority | "all"; l: string }> = [
    { v: "all", l: "All priorities" },
    { v: "high", l: "High ⏫" },
    { v: "medium", l: "Medium 🔼" },
    { v: "low", l: "Low 🔽" },
    { v: "none", l: "Normal" },
  ];
  for (const opt of prioOpts) {
    prioSelect.createEl("option", { value: opt.v, text: opt.l });
  }
  prioSelect.value = state.priorityFilter;
  prioSelect.addEventListener("change", () => {
    state.priorityFilter = prioSelect.value as TaskPriority | "all";
    renderListContent();
  });

  const sortSelect = toolbar.createEl("select", { cls: "life-os-select-compact" });
  const sortOpts: Array<{ v: TaskHubSort; l: string }> = [
    { v: "due", l: "Sort: Due date" },
    { v: "priority", l: "Sort: Priority" },
    { v: "file", l: "Sort: Note name" },
    { v: "title", l: "Sort: Title" },
  ];
  for (const opt of sortOpts) {
    sortSelect.createEl("option", { value: opt.v, text: opt.l });
  }
  sortSelect.value = state.sort;
  sortSelect.addEventListener("change", () => {
    state.sort = sortSelect.value as TaskHubSort;
    renderListContent();
  });

  const groupSelect = toolbar.createEl("select", { cls: "life-os-select-compact" });
  const groupOpts: Array<{ v: TaskHubGroup; l: string }> = [
    { v: "status", l: "Group: Smart status" },
    { v: "priority", l: "Group: Priority" },
    { v: "file", l: "Group: Note file" },
    { v: "none", l: "Group: None" },
  ];
  for (const opt of groupOpts) {
    groupSelect.createEl("option", { value: opt.v, text: opt.l });
  }
  groupSelect.value = state.groupBy;
  groupSelect.addEventListener("change", () => {
    state.groupBy = groupSelect.value as TaskHubGroup;
    renderListContent();
  });

  // Tag chip bar (top tags in current scope)
  const tagCounts = new Map<string, number>();
  for (const e of scopedEntries) {
    if (!e.task.tags) continue;
    for (const tag of e.task.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 12);

  const tagBarEl = wrap.createDiv({ cls: "life-os-th-tags-bar" });
  const renderTagBar = (): void => {
    tagBarEl.empty();
    if (topTags.length === 0 && !state.tagFilter) {
      tagBarEl.addClass("is-hidden");
      return;
    }
    tagBarEl.removeClass("is-hidden");
    const allChip = tagBarEl.createEl("button", {
      text: "All tags",
      cls: `life-os-th-tag-chip ${state.tagFilter === null ? "is-active" : ""}`,
      attr: { type: "button" },
    });
    allChip.addEventListener("click", () => {
      state.tagFilter = null;
      renderTagBar();
      renderListContent();
    });

    for (const [tag, count] of topTags) {
      const chip = tagBarEl.createEl("button", {
        text: `#${tag} (${count})`,
        cls: `life-os-th-tag-chip ${state.tagFilter === tag ? "is-active" : ""}`,
        attr: { type: "button" },
      });
      chip.addEventListener("click", () => {
        state.tagFilter = state.tagFilter === tag ? null : tag;
        renderTagBar();
        renderListContent();
      });
    }
  };
  renderTagBar();

  const listWrap = wrap.createDiv({ cls: "life-os-th-list-wrap" });

  const toggleTagFromRow = (tag: string): void => {
    state.tagFilter = state.tagFilter === tag ? null : tag;
    renderTagBar();
    renderListContent();
  };

  const renderListContent = (): void => {
    listWrap.empty();
    const q = state.searchQuery.trim().toLowerCase();

    const filtered = scopedEntries
      .filter((e) => matchesBucket(e, state.bucket, todayIso, upcomingEndIso))
      .filter((e) => state.priorityFilter === "all" || e.task.priority === state.priorityFilter)
      .filter((e) => !state.tagFilter || Boolean(e.task.tags?.includes(state.tagFilter)))
      .filter((e) => {
        if (!q) return true;
        return (
          e.task.title.toLowerCase().includes(q) ||
          e.fileBasename.toLowerCase().includes(q) ||
          (e.heading?.toLowerCase().includes(q) ?? false) ||
          (e.task.recurrence?.toLowerCase().includes(q) ?? false)
        );
      })
      .sort((a, b) => compareEntries(a, b, state.sort));

    if (filtered.length === 0) {
      listWrap.createDiv({ text: "No tasks match the current filters.", cls: "life-os-empty-state" });
      return;
    }

    const groups = buildGroups(filtered, state.groupBy, todayIso);
    for (const grp of groups) {
      const section = listWrap.createDiv({ cls: "life-os-th-group" });
      if (grp.label) {
        const gHead = section.createDiv({ cls: "life-os-th-group-head" });
        if (grp.filePath) {
          const linkBtn = gHead.createEl("button", {
            text: `[[${grp.label}]]`,
            cls: "life-os-th-note-link",
            attr: { type: "button", title: `Open ${grp.filePath}` },
          });
          const targetPath = grp.filePath;
          linkBtn.addEventListener("click", () => {
            void host.onOpenFile(targetPath);
          });
        } else {
          gHead.createSpan({ text: grp.label, cls: "life-os-th-group-title" });
        }
        gHead.createSpan({ text: String(grp.items.length), cls: "life-os-th-group-count" });
      }

      const ul = section.createDiv({ cls: "life-os-th-rows" });
      for (const entry of grp.items) {
        renderTaskRow(ul, entry, todayIso, state.tagFilter, toggleTagFromRow, host);
      }
    }
  };

  renderListContent();
}

function replaceWithFreshContainer(oldWrap: HTMLElement): HTMLElement {
  const parent = oldWrap.parentElement;
  if (!parent) return oldWrap;
  parent.empty();
  return parent;
}

function renderTaskRow(
  parent: HTMLElement,
  entry: VaultTaskEntry,
  todayIso: string,
  activeTag: string | null,
  onTagClick: (tag: string) => void,
  host: TasksHubHost
): void {
  const t = entry.task;
  const eff = getEffectiveDateIso(t);
  const isOverdue = !t.done && Boolean(eff) && eff! < todayIso;
  const isToday = !t.done && eff === todayIso;

  const row = parent.createDiv({
    cls: `life-os-th-row ${t.done ? "is-done" : ""} ${isOverdue ? "is-overdue" : ""}`,
  });

  const checkbox = row.createEl("input", {
    cls: "life-os-checkbox",
    attr: { type: "checkbox" },
  });
  checkbox.checked = t.done;
  checkbox.addEventListener("change", () => {
    void host.onToggleTask(entry);
  });

  const prioMeta = PRIORITY_LABELS[t.priority];
  const prioBtn = row.createEl("button", {
    text: prioMeta.glyph,
    cls: `life-os-th-prio prio-${t.priority}`,
    attr: { type: "button", title: prioMeta.title },
  });
  prioBtn.addEventListener("click", () => {
    void host.onCyclePriority(entry);
  });

  const body = row.createDiv({ cls: "life-os-th-body" });
  const titleEl = body.createDiv({ cls: "life-os-th-title-text" });
  renderTitleWithTagPills(titleEl, t.title, activeTag, onTagClick);

  const meta = body.createDiv({ cls: "life-os-th-meta" });
  const sourceLabel = entry.heading && !entry.isDailyNote
    ? `[[${entry.fileBasename}]] › ${entry.heading}`
    : `[[${entry.fileBasename}]]`;
  const noteBtn = meta.createEl("button", {
    text: sourceLabel,
    cls: "life-os-th-chip is-note",
    attr: { type: "button", title: `Open ${entry.filePath}` },
  });
  noteBtn.addEventListener("click", () => {
    void host.onOpenFile(entry.filePath);
  });

  if (t.dueDateIso) {
    const dueCls = !t.done && t.dueDateIso < todayIso
      ? "is-overdue"
      : isToday
        ? "is-today"
        : "";
    meta.createSpan({
      text: `📅 ${t.dueDateIso}`,
      cls: `life-os-th-chip ${dueCls}`,
    });
  }
  if (t.scheduledDateIso) {
    meta.createSpan({
      text: `⏳ ${t.scheduledDateIso}`,
      cls: "life-os-th-chip",
    });
  }
  if (t.startDateIso) {
    meta.createSpan({
      text: `🛫 ${t.startDateIso}`,
      cls: "life-os-th-chip",
    });
  }
  if (t.recurrence) {
    meta.createSpan({
      text: `🔁 ${t.recurrence}`,
      cls: "life-os-th-chip is-recur",
    });
  }
  if (t.done && t.doneDateIso) {
    meta.createSpan({
      text: `✅ ${t.doneDateIso}`,
      cls: "life-os-th-chip is-done-date",
    });
  }

  const actions = row.createDiv({ cls: "life-os-th-actions" });
  if (!t.done) {
    const schedBtn = actions.createEl("button", {
      text: "⏱",
      cls: "life-os-btn-subtle life-os-btn-mini",
      attr: { type: "button", title: "Schedule onto today's timeline" },
    });
    schedBtn.addEventListener("click", () => {
      void host.onScheduleTask(entry);
    });

    const postponeBtn = actions.createEl("button", {
      text: "+1d",
      cls: "life-os-th-mini-btn",
      attr: { type: "button", title: "Postpone by 1 day" },
    });
    postponeBtn.addEventListener("click", () => {
      void host.onPostponeTask(entry);
    });
  }

  const delBtn = actions.createEl("button", {
    text: "×",
    cls: "life-os-btn-del",
    attr: { type: "button", title: "Delete task from note" },
  });
  delBtn.addEventListener("click", () => {
    void host.onDeleteTask(entry);
  });
}

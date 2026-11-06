// Life OS — view constants + helpers ported from Nihon 1.3.0 (L2224-2807)
import type { WorkspaceLeaf } from "obsidian";
import { ItemView } from "obsidian";
import type LifeOSPlugin from "./main";

export const DASHBOARD_VIEW_TYPE = "life-os-dashboard";
export const TIMELINE_VIEW_TYPE = "life-os-timeline";

export const MOOD_OPTIONS: Array<[string, string]> = [
  ["", "— Mood —"],
  ["5", "⚡ 5 · Peak / Joyful"],
  ["4", "🙂 4 · Good / Content"],
  ["3", "😐 3 · Neutral / Fine"],
  ["2", "🥱 2 · Low / Tired"],
  ["1", "😫 1 · Very Low / Stressed"],
];

export const ENERGY_OPTIONS: Array<[string, string]> = [
  ["", "— Energy —"],
  ["5", "⚡ 5 · Maximum Focus"],
  ["4", "🔋 4 · High Energy"],
  ["3", "⚖️ 3 · Steady / OK"],
  ["2", "📉 2 · Sluggish / Low"],
  ["1", "🪫 1 · Exhausted"],
];

export const PRAYER_STATUS_LABELS: Record<string, string> = {
  "": "Not Set",
  done: "Prayed",
  jamaah: "Jama'ah",
  late: "Late",
  missed: "Missed",
};

export function get15MinTimeOptions(isBedtime = false): Array<[string, string]> {
  const options: Array<[string, string]> = [["", "—:—"]];
  const startMinute = isBedtime ? 20 * 60 : 5 * 60;
  for (let i = 0; i < 96; i++) {
    const m = (startMinute + i * 15) % 1440;
    const hh = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    const hhmm = `${hh}:${mm}`;
    const hour12 = Math.floor(m / 60) % 12 || 12;
    const ampm = Math.floor(m / 60) >= 12 ? "PM" : "AM";
    options.push([hhmm, `${hhmm} (${hour12}:${mm} ${ampm})`]);
  }
  return options;
}

export class DashboardView extends ItemView {
  constructor(leaf: WorkspaceLeaf, public plugin: LifeOSPlugin) {
    super(leaf);
  }
  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }
  getDisplayText(): string {
    return "Life OS · Cockpit";
  }
  getIcon(): string {
    return "layout-dashboard";
  }
  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("life-os-root");
    contentEl.createEl("h2", { text: "Life OS · Cockpit — full dashboard is the next split step." });
  }
  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}

export class TimelineView extends ItemView {
  constructor(leaf: WorkspaceLeaf, public plugin: LifeOSPlugin) {
    super(leaf);
  }
  getViewType(): string {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText(): string {
    return "Life OS · Timeline";
  }
  getIcon(): string {
    return "calendar-clock";
  }
  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("life-os-root");
    contentEl.createEl("h2", { text: "Life OS · Timeline — full timeline is the next split step." });
  }
  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}

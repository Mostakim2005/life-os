/** Shared Life OS styles. Kept in TypeScript so Obsidian can inject one stylesheet at runtime. */
export const LIFE_OS_CSS = `
.life-os-root{box-sizing:border-box;width:100%;max-width:1600px;margin:0 auto;padding:clamp(12px,2vw,24px);color:var(--text-normal)}
.life-os-root *, .life-os-root *::before, .life-os-root *::after{box-sizing:border-box}
.life-os-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px}
.life-os-root h1{margin:0;font-size:clamp(24px,3vw,32px)}
.life-os-subtitle,.life-os-help,.life-os-kpi-label,.life-os-calendar-head,.life-os-time,.life-os-chart-label,.life-os-chart-footer{color:var(--text-muted)}
.life-os-header-controls,.life-os-tabs,.life-os-inline-form,.life-os-actions,.life-os-planner-toolbar,.life-os-review-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.life-os-tabs{overflow-x:auto;scrollbar-width:thin;padding-bottom:3px}
.life-os-tabs button{white-space:nowrap}
.life-os-tabs button.is-active{box-shadow:inset 0 -2px 0 var(--interactive-accent);font-weight:600}
.life-os-tabs button:focus-visible,.life-os-root button:focus-visible,.life-os-root input:focus-visible,.life-os-root select:focus-visible,.life-os-root textarea:focus-visible{outline:2px solid var(--interactive-accent);outline-offset:2px}
.life-os-kpis{display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:10px;margin-bottom:14px}
.life-os-kpi,.life-os-section,.life-os-card,.life-os-goal-card,.life-os-habit-card,.life-os-planning-rule-card,.life-os-unscheduled-card,.life-os-chart-card{border:1px solid var(--background-modifier-border);background:var(--background-secondary);border-radius:14px;box-shadow:var(--shadow-s,0 1px 2px rgba(0,0,0,.06))}
.life-os-kpi{padding:14px}.life-os-kpi-value{font-size:21px;font-weight:700;margin-top:5px}
.life-os-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.life-os-section{padding:14px}.life-os-section h2{margin:0 0 10px;font-size:16px}
.life-os-row,.life-os-stat-row{display:grid;grid-template-columns:minmax(120px,1fr) auto auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--background-modifier-border)}
.life-os-row:last-child,.life-os-stat-row:last-child{border-bottom:0}
.life-os-row-title{font-weight:600;min-width:0}.life-os-row-title,.life-os-reason{overflow:hidden;text-overflow:ellipsis}
.life-os-reason{font-size:12px;max-width:220px;white-space:nowrap}
.life-os-subtasks{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.life-os-form-row{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:8px 0}.life-os-form-row input{max-width:130px}
.life-os-section textarea{display:block;width:100%;min-height:60px;margin-top:8px;resize:vertical}
.life-os-inline-form input,.life-os-inline-form select{min-width:95px;max-width:100%}.life-os-subheading{font-weight:700;margin-top:12px}
.life-os-timeline{position:relative;height:60px;margin:12px 0;background:var(--background-primary);border-radius:8px;overflow:hidden;border:1px solid var(--background-modifier-border)}
.life-os-timeline-scale{position:absolute;inset:0;display:grid;grid-template-columns:repeat(24,1fr)}
.life-os-timeline-hour{font-size:8px;border-right:1px solid var(--background-modifier-border);padding:5px 2px;color:var(--text-muted)}
.life-os-timeline-blocks{position:absolute;left:0;right:0;bottom:5px;height:30px}
.life-os-time-block{position:absolute;top:0;bottom:0;border-radius:7px;padding:6px;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--background-modifier-hover);border:1px solid var(--interactive-accent);box-sizing:border-box;cursor:pointer}
.life-os-time-block.is-actual{background:color-mix(in srgb,var(--interactive-accent) 20%,transparent)}
.life-os-calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.life-os-calendar-empty{min-height:34px}
.life-os-calendar-day{min-height:42px;position:relative}.life-os-calendar-day.has-habit::after,.life-os-calendar-day.has-plan::before{content:'';position:absolute;bottom:4px;width:5px;height:5px;border-radius:50%}.life-os-calendar-day.has-habit::after{right:6px;background:var(--interactive-accent)}.life-os-calendar-day.has-plan::before{left:6px;background:var(--text-muted)}
.life-os-calendar-day.has-complete{box-shadow:inset 0 -2px 0 var(--interactive-accent)}.life-os-calendar-day.is-selected{outline:2px solid var(--interactive-accent);outline-offset:-2px}
.life-os-week-grid{display:grid;grid-template-columns:56px repeat(7,minmax(105px,1fr));border:1px solid var(--background-modifier-border);border-radius:16px;overflow:auto;background:var(--background-primary);margin-top:14px}
.life-os-week-hour{height:42px;padding:4px;border-right:1px solid var(--background-modifier-border);border-top:1px solid var(--background-modifier-border);font-size:11px;color:var(--text-muted)}
.life-os-week-day{position:relative;min-width:105px;height:1045px;border-right:1px solid var(--background-modifier-border);isolation:isolate}
.life-os-week-day-head{position:sticky;top:0;height:38px;padding:6px 8px;background:var(--background-secondary);border-bottom:1px solid var(--background-modifier-border);font-weight:700;z-index:3}
.life-os-week-slot{position:absolute;left:0;right:0;height:42px;border-top:1px solid var(--background-modifier-border)}
.life-os-planner-block{position:absolute;left:3px;right:3px;min-height:24px;border-radius:7px;padding:4px 6px;font-size:11px;overflow:hidden;z-index:2;border:1px solid var(--interactive-accent);background:var(--background-secondary);cursor:pointer;touch-action:none}
.life-os-planner-block:focus-visible{outline:2px solid var(--interactive-accent);outline-offset:1px}.life-os-planner-block.is-actual{background:color-mix(in srgb,var(--interactive-accent) 22%,transparent)}
.life-os-planner-block-title,.life-os-planner-block-meta{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.life-os-planner-block-title{font-weight:700}.life-os-planner-block-meta{font-size:10px;color:var(--text-muted)}
.life-os-planner-resize{position:absolute;left:0;right:0;bottom:0;height:8px;cursor:ns-resize;border-radius:0 0 7px 7px;background:color-mix(in srgb,var(--interactive-accent) 22%,transparent)}
.life-os-planner-resize:focus-visible{outline:2px solid var(--interactive-accent);outline-offset:-2px}.life-os-planner-block-pulse{outline:2px solid var(--interactive-accent)}
body.life-os-planner-dragging{cursor:grabbing!important;user-select:none}
.life-os-planner-hint,.life-os-empty-state{margin-top:8px;padding:8px 12px;border-radius:10px;background:var(--background-secondary);color:var(--text-muted);font-size:12px}
.life-os-chart-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.life-os-chart-card{padding:14px;min-height:190px}.life-os-chart-card h3{margin:0 0 10px;font-size:15px}
.life-os-chart-bars{height:130px;display:flex;align-items:flex-end;gap:3px;border-bottom:1px solid var(--background-modifier-border);padding:4px 2px 0}.life-os-chart-point{height:100%;flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;min-width:4px}.life-os-chart-bar{width:100%;max-width:18px;min-height:3px;border-radius:5px 5px 0 0;background:var(--interactive-accent);opacity:.75}.life-os-chart-label{font-size:8px;margin-top:4px;max-width:24px;white-space:nowrap}
.life-os-chart-footer{display:flex;justify-content:space-between;margin-top:8px;font-size:11px}.life-os-review-prompt{padding:8px 0;border-bottom:1px solid var(--background-modifier-border)}
.life-os-habit-builder-list,.life-os-planning-rule-list,.life-os-goal-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.life-os-planning-rule-card,.life-os-habit-card,.life-os-goal-card{padding:14px}
.life-os-habit-card-head,.life-os-goal-head,.life-os-goal-actions{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px}.life-os-habit-card .setting-item{border-top:1px solid var(--background-modifier-border);padding:9px 0}.life-os-subtasks-editor{margin-top:10px}.life-os-subtasks-editor input{width:100%}
.life-os-conflict-badge{position:absolute;right:7px;top:41px;z-index:4;background:var(--background-modifier-error);color:var(--text-error);border:1px solid var(--text-error);border-radius:7px;padding:3px 6px;font-size:10px;font-weight:700}.life-os-planner-block[data-rule]{border-style:dashed}.life-os-planner-block.is-conflicted{box-shadow:0 0 0 2px var(--text-error)}
.life-os-goal-bar{height:8px;background:var(--background-modifier-border);border-radius:999px;overflow:hidden;margin:12px 0}.life-os-goal-fill{height:100%;background:var(--interactive-accent);border-radius:inherit}.life-os-priority-row{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--background-modifier-border)}
.life-os-report-range{margin:10px 0;color:var(--text-muted)}.life-os-card pre{white-space:pre-wrap;overflow:auto;font-size:11px;border-radius:10px;padding:10px;background:var(--background-primary)}
.life-os-unscheduled-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.life-os-unscheduled-card{padding:12px;cursor:grab;touch-action:none}.life-os-unscheduled-card.is-dragging{opacity:.55}.life-os-unscheduled-card:focus-visible{outline:2px solid var(--interactive-accent)}
@media (max-width:1000px){.life-os-chart-grid,.life-os-goal-grid,.life-os-habit-builder-list,.life-os-planning-rule-list{grid-template-columns:1fr}.life-os-kpis{grid-template-columns:repeat(3,1fr)}.life-os-grid{grid-template-columns:1fr}.life-os-header{flex-direction:column}.life-os-unscheduled-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:650px){.life-os-root{padding:12px;max-width:100vw;overflow-x:hidden}.life-os-header{position:sticky;top:0;z-index:10;padding:8px 0;background:color-mix(in srgb,var(--background-primary) 92%,transparent);backdrop-filter:blur(8px)}.life-os-tabs{flex-wrap:nowrap}.life-os-kpis{grid-template-columns:repeat(2,1fr)}.life-os-priority-row{grid-template-columns:1fr auto}.life-os-header-controls button,.life-os-actions button{min-height:38px}.life-os-row input,.life-os-row select,.life-os-form-row input{min-height:36px}.life-os-week-grid{touch-action:pan-x;grid-template-columns:48px repeat(7,95px)}.life-os-planner-block{font-size:10px}.life-os-planner-block-meta{font-size:9px}.life-os-row,.life-os-stat-row{grid-template-columns:1fr auto}.life-os-reason{display:none}.life-os-unscheduled-grid{grid-template-columns:1fr}}
@media (prefers-reduced-motion: reduce){.life-os-root *, .life-os-root *::before, .life-os-root *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
@media (pointer:coarse){.life-os-root button,.life-os-root input,.life-os-root select,.life-os-root textarea{min-height:36px}.life-os-planner-resize{height:12px}}
`;

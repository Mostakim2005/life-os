# Life OS

All-in-one full-window Obsidian cockpit for daily habits, sleep and hydration vitals, prayers, tasks, and offline analytics.

## UI/UX Surface Inventory

| Surface | Implementation |
| :--- | :--- |
| **Ribbon Icon** | Dashboard icon (`Open cockpit`) opening the auto-pinned `LifeOSCockpitView`. |
| **Workspace View** | Full-window `LifeOSCockpitView` (`ItemView`) with close-protection pinning. |
| **Status Bar** | Clickable `Life OS: Cockpit` pill to focus or open the cockpit view. |
| **Safety Modals** | `ConfirmModal` guarding bulk legacy daily-note filename migrations. |
| **Settings Tab** | `LifeOSSettingTab` covering storage mode, hydration unit, prayer settings, and exports. |

## Documentation

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS_AND_TRAPS.md`
- `docs/VISUAL_LOG.md`
- `AGENTS.md`

## Develop

```bash
npm install
npm run build
```

## License

See `LICENSE`.

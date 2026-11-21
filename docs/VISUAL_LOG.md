# Visual Feature & Change Log (`VISUAL_LOG.md`)
> **1-Line Summary:** Flowcharts explaining Life OS daily tracking, stats engine, and cockpit lifecycle.

## Feature & Change Flowcharts

### [VISUAL: Full-Window-Cockpit-Tab-Lifecycle] | Aliases: cockpit tab flow, item view open
> **1-Line Summary:** User clicks ribbon icon or runs command; workspace activates full-window pinned tab and populates current daily note.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff

    Ribbon([User clicks Ribbon Icon / Command]):::startNode --> Activate[LifeOSCockpitView.activateCockpitView]:::processNode
    Activate --> Pin[Set Tab State: Pinned for Close Protection]:::processNode
    Pin --> LoadNote[Load or Initialize Today's DD-MM-YYYY Note]:::processNode
    LoadNote --> Render[Render Active Tab: Cockpit / Calendar / Stats / Tasks]:::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Action]):::startNode
        L2[Teal = Plugin Lifecycle & Workspace Routing]:::processNode
        L3([Green = Rendered Cockpit Interface]):::outputNode
    end
```

### [VISUAL: Non-Destructive-Note-Parsing-Cycle] | Aliases: habit toggle flow, section update flow
> **1-Line Summary:** User modifies metric or habit; parser preserves existing note text and applies surgical section rewrite.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff

    Start([Start: User toggles Habit / Pill / Stepper]):::startNode --> Read[Fetch Today's DD-MM-YYYY.md Note]:::processNode
    Read --> Parse[Parse Daily Note & Extract Fields]:::processNode
    Parse --> Update[Update In-Memory Structure & Recompute Liters/Streaks]:::processNode
    Update --> Apply[applyParsedNoteToMarkdown: Surgical Bounded Replacement]:::processNode
    Apply --> Save([Save Note & Re-render Cockpit Cards]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Click / Interaction]):::startNode
        L2[Teal = Note Parsing & Bounded Surgery]:::processNode
        L3([Green = Updated Local Markdown Note]):::outputNode
    end
```

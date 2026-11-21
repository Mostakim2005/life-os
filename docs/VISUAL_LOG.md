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

### [VISUAL: Task-NLP-And-Recurrence-Lifecycle] | Aliases: task chrono parse, rrule reschedule
> **1-Line Summary:** Chrono-node extracts natural language dates during task entry; on completion, RRule calculates and schedules the next date.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff
    classDef rruleNode fill:#d97706,stroke:#b45309,color:#ffffff

    Input([User inputs task with date phrase & recurrence]):::startNode --> Chrono[Chrono-Node Extracts Due Date & Strips Title]:::processNode
    Chrono --> AddTask[Task saved with dueDateIso and recurrence token]:::processNode
    AddTask --> Complete([User checks task done]):::startNode
    Complete --> CheckRecurrence{Has 🔁 Recurrence?}:::processNode
    CheckRecurrence -->|No| Done([Task marked done with ✅ date]):::outputNode
    CheckRecurrence -->|Yes| ComputeNext[RRule Computes Next Date]:::rruleNode
    ComputeNext --> ScheduleNext([Append fresh task to target DD-MM-YYYY note]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Action]):::startNode
        L2[Teal = Chrono NLP Processing]:::processNode
        L3[Amber = RRule Next Date Calculation]:::rruleNode
        L4([Green = Markdown Daily Note Storage]):::outputNode
    end
```

### [VISUAL: Offline-Python-Analytics-Pipeline] | Aliases: python analytics pipeline, monthly report flow
> **1-Line Summary:** Python script parses inline fields across daily notes to produce rolling averages, CSV summary, and PNG trend plots.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff

    Trigger([Obsidian Command / Terminal Trigger]):::startNode --> Scan[Scan DD-MM-YYYY.md Notes in Vault Folder]:::processNode
    Scan --> Extract[Regex Extraction: sleep, water, prayers, habits]:::processNode
    Extract --> Compute[Calculate 7-Day Rolling Averages & Jamaah %]:::processNode
    Compute --> ExportCSV([Write exports/monthly-summary.csv]):::outputNode
    Compute --> RenderPlot([Render 3-Panel Matplotlib Figure]):::processNode
    RenderPlot --> ExportPNG([Save exports/monthly-trends.png]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = Command or Script Trigger]):::startNode
        L2[Teal = Analytics & Parsing Engine]:::processNode
        L3([Green = Export Deliverables: CSV & PNG]):::outputNode
    end
```

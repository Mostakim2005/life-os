# Visual Feature & Change Log (`VISUAL_LOG.md`)
> **1-Line Summary:** Flowcharts explaining Life OS daily tracking and note surgery.

## Feature & Change Flowcharts

### [VISUAL: Daily-Cockpit-Update-Cycle] | Aliases: habit toggle flow, section update flow
> **1-Line Summary:** User clicks habit in cockpit; plugin performs surgical section update in today's daily note.

```mermaid
flowchart TD
    %% Color Definitions (Obsidian & GitHub compatible)
    classDef startNode fill:#1d4ed8,stroke:#1e3a8a,color:#ffffff
    classDef processNode fill:#0f766e,stroke:#115e59,color:#ffffff
    classDef outputNode fill:#15803d,stroke:#14532d,color:#ffffff

    Start([Start: User toggles Habit / Stepper]):::startNode --> Read[Fetch Today's Daily Note]:::processNode
    Read --> Locate[Locate Bounded Heading Section]:::processNode
    Locate --> Modify[Update Line in Habit Table]:::processNode
    Modify --> Save([Save Markdown Note]):::outputNode

    subgraph Legend["Legend (Color Guide)"]
        L1([Blue = User Click / Interaction]):::startNode
        L2[Teal = Note Parsing & Bounded Surgery]:::processNode
        L3([Green = Updated Local Markdown Note]):::outputNode
    end
```

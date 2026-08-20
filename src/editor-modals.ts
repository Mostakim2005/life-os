import { App, Modal, Setting } from 'obsidian';
import { ExerciseEntry, MealEntry } from './types';

export function editExercise(app: App, original: ExerciseEntry): Promise<ExerciseEntry | null> {
  return new Promise<ExerciseEntry | null>((resolve) => {
    new ExerciseEditorModal(app, original, resolve).open();
  });
}

export function editMeal(app: App, original: MealEntry): Promise<MealEntry | null> {
  return new Promise<MealEntry | null>((resolve) => {
    new MealEditorModal(app, original, resolve).open();
  });
}

class ExerciseEditorModal extends Modal {
  private value: ExerciseEntry;

  constructor(
    app: App,
    original: ExerciseEntry,
    private readonly done: (value: ExerciseEntry | null) => void,
  ) {
    super(app);
    this.value = { ...original };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Edit exercise' });

    new Setting(contentEl)
      .setName('Exercise')
      .addText((text) => text.setValue(this.value.name).onChange((value) => {
        this.value.name = value.trim();
      }));

    new Setting(contentEl)
      .setName('Category')
      .addText((text) => text.setValue(this.value.category).onChange((value) => {
        this.value.category = value.trim();
      }));

    new Setting(contentEl)
      .setName('Duration (minutes)')
      .addText((text) => text.setValue(String(this.value.durationMin)).onChange((value) => {
        this.value.durationMin = Math.max(0, Number(value) || 0);
      }));

    new Setting(contentEl)
      .setName('Sets')
      .addText((text) => text.setValue(String(this.value.sets ?? '')).onChange((value) => {
        this.value.sets = value.trim() ? Math.max(0, Math.floor(Number(value) || 0)) : undefined;
      }));

    new Setting(contentEl)
      .setName('Reps')
      .addText((text) => text.setValue(String(this.value.reps ?? '')).onChange((value) => {
        this.value.reps = value.trim() ? Math.max(0, Math.floor(Number(value) || 0)) : undefined;
      }));

    new Setting(contentEl)
      .setName('Load (kg)')
      .addText((text) => text.setValue(String(this.value.loadKg ?? '')).onChange((value) => {
        this.value.loadKg = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Distance (km)')
      .addText((text) => text.setValue(String(this.value.distanceKm ?? '')).onChange((value) => {
        this.value.distanceKm = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Intensity / rpe')
      .addText((text) => text.setValue(String(this.value.intensity ?? '')).onChange((value) => {
        this.value.intensity = value.trim()
          ? Math.min(10, Math.max(0, Number(value) || 0))
          : undefined;
      }));

    new Setting(contentEl)
      .setName('Muscle group')
      .addText((text) => text.setValue(this.value.muscleGroup ?? '').onChange((value) => {
        this.value.muscleGroup = value.trim() || undefined;
      }));

    new Setting(contentEl)
      .setName('Notes')
      .addTextArea((text) => text.setValue(this.value.note ?? '').onChange((value) => {
        this.value.note = value.trim() || undefined;
      }));

    new Setting(contentEl)
      .addButton((button) => button.setButtonText('Cancel').onClick(() => {
        this.done(null);
        this.close();
      }));

    new Setting(contentEl)
      .addButton((button) => button.setCta().setButtonText('Save').onClick(() => {
        if (!this.value.name.trim()) return;
        this.done({ ...this.value });
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class MealEditorModal extends Modal {
  private value: MealEntry;

  constructor(
    app: App,
    original: MealEntry,
    private readonly done: (value: MealEntry | null) => void,
  ) {
    super(app);
    this.value = { ...original };
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Edit meal' });

    new Setting(contentEl)
      .setName('Meal')
      .addText((text) => text.setValue(this.value.meal).onChange((value) => {
        this.value.meal = value.trim();
      }));

    new Setting(contentEl)
      .setName('Food')
      .addText((text) => text.setValue(this.value.food).onChange((value) => {
        this.value.food = value.trim();
      }));

    new Setting(contentEl)
      .setName('Category')
      .addDropdown((dropdown) => {
        const categories: MealEntry['category'][] = ['muscle', 'stamina', 'health', 'budget', 'general'];
        categories.forEach((value) => dropdown.addOption(value, value));
        dropdown.setValue(this.value.category);
        dropdown.onChange((value) => {
          if (categories.includes(value as MealEntry['category'])) {
            this.value.category = value as MealEntry['category'];
          }
        });
      });

    new Setting(contentEl)
      .setName('Servings')
      .addText((text) => text.setValue(String(this.value.servings ?? '')).onChange((value) => {
        this.value.servings = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Calories')
      .addText((text) => text.setValue(String(this.value.estimatedCalories ?? '')).onChange((value) => {
        this.value.estimatedCalories = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Protein (g)')
      .addText((text) => text.setValue(String(this.value.estimatedProteinG ?? '')).onChange((value) => {
        this.value.estimatedProteinG = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Carbs (g)')
      .addText((text) => text.setValue(String(this.value.estimatedCarbsG ?? '')).onChange((value) => {
        this.value.estimatedCarbsG = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Fat (g)')
      .addText((text) => text.setValue(String(this.value.estimatedFatG ?? '')).onChange((value) => {
        this.value.estimatedFatG = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .setName('Fiber (g)')
      .addText((text) => text.setValue(String(this.value.estimatedFiberG ?? '')).onChange((value) => {
        this.value.estimatedFiberG = value.trim() ? Math.max(0, Number(value) || 0) : undefined;
      }));

    new Setting(contentEl)
      .addButton((button) => button.setButtonText('Cancel').onClick(() => {
        this.done(null);
        this.close();
      }));

    new Setting(contentEl)
      .addButton((button) => button.setCta().setButtonText('Save').onClick(() => {
        if (!this.value.food.trim()) return;
        this.done({ ...this.value });
        this.close();
      }));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

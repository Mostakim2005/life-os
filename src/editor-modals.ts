import { App, Modal, Setting } from 'obsidian';
import { ExerciseEntry, MealEntry } from './types';

export async function editExercise(app: App, original: ExerciseEntry): Promise<ExerciseEntry | null> {
  return new Promise((resolve) => new ExerciseEditorModal(app, original, resolve).open());
}

export async function editMeal(app: App, original: MealEntry): Promise<MealEntry | null> {
  return new Promise((resolve) => new MealEditorModal(app, original, resolve).open());
}

class ExerciseEditorModal extends Modal {
  private value: ExerciseEntry;
  constructor(app: App, original: ExerciseEntry, private readonly done: (value: ExerciseEntry | null) => void) {
    super(app);
    this.value = { ...original };
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Edit exercise' });
    new Setting(contentEl).setName('Exercise').addText((text) => text.setValue(this.value.name).onChange((v) => { this.value.name = v.trim(); }));
    new Setting(contentEl).setName('Category').addText((text) => text.setValue(this.value.category).onChange((v) => { this.value.category = v.trim(); }));
    new Setting(contentEl).setName('Duration (minutes)').addText((text) => text.setValue(String(this.value.durationMin)).onChange((v) => { this.value.durationMin = Math.max(0, Number(v) || 0); }));
    new Setting(contentEl).setName('Sets').addText((text) => text.setValue(String(this.value.sets ?? '')).onChange((v) => { this.value.sets = v.trim() ? Math.max(0, Math.floor(Number(v) || 0)) : undefined; }));
    new Setting(contentEl).setName('Reps').addText((text) => text.setValue(String(this.value.reps ?? '')).onChange((v) => { this.value.reps = v.trim() ? Math.max(0, Math.floor(Number(v) || 0)) : undefined; }));
    new Setting(contentEl).setName('Load (kg)').addText((text) => text.setValue(String(this.value.loadKg ?? '')).onChange((v) => { this.value.loadKg = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Distance (km)').addText((text) => text.setValue(String(this.value.distanceKm ?? '')).onChange((v) => { this.value.distanceKm = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Intensity / RPE').addText((text) => text.setValue(String(this.value.intensity ?? '')).onChange((v) => { this.value.intensity = v.trim() ? Math.min(10, Math.max(0, Number(v) || 0)) : undefined; }));
    new Setting(contentEl).setName('Muscle group').addText((text) => text.setValue(this.value.muscleGroup ?? '').onChange((v) => { this.value.muscleGroup = v.trim() || undefined; }));
    new Setting(contentEl).setName('Notes').addTextArea((text) => text.setValue(this.value.note ?? '').onChange((v) => { this.value.note = v.trim() || undefined; }));
    new Setting(contentEl).addButton((button) => button.setButtonText('Cancel').onClick(() => { this.done(null); this.close(); }));
    new Setting(contentEl).addButton((button) => button.setCta().setButtonText('Save').onClick(() => {
      if (!this.value.name) return;
      this.done(this.value);
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

class MealEditorModal extends Modal {
  private value: MealEntry;
  constructor(app: App, original: MealEntry, private readonly done: (value: MealEntry | null) => void) {
    super(app);
    this.value = { ...original };
  }
  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Edit meal' });
    new Setting(contentEl).setName('Meal').addText((text) => text.setValue(this.value.meal).onChange((v) => { this.value.meal = v.trim(); }));
    new Setting(contentEl).setName('Food').addText((text) => text.setValue(this.value.food).onChange((v) => { this.value.food = v.trim(); }));
    new Setting(contentEl).setName('Category').addDropdown((drop) => {
      ['muscle', 'stamina', 'health', 'budget', 'general'].forEach((value) => drop.addOption(value, value));
      drop.setValue(this.value.category);
      drop.onChange((v) => { this.value.category = v as MealEntry['category']; });
    });
    new Setting(contentEl).setName('Servings').addText((text) => text.setValue(String(this.value.servings ?? '')).onChange((v) => { this.value.servings = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Calories').addText((text) => text.setValue(String(this.value.estimatedCalories ?? '')).onChange((v) => { this.value.estimatedCalories = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Protein (g)').addText((text) => text.setValue(String(this.value.estimatedProteinG ?? '')).onChange((v) => { this.value.estimatedProteinG = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Carbs (g)').addText((text) => text.setValue(String(this.value.estimatedCarbsG ?? '')).onChange((v) => { this.value.estimatedCarbsG = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Fat (g)').addText((text) => text.setValue(String(this.value.estimatedFatG ?? '')).onChange((v) => { this.value.estimatedFatG = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).setName('Fiber (g)').addText((text) => text.setValue(String(this.value.estimatedFiberG ?? '')).onChange((v) => { this.value.estimatedFiberG = v.trim() ? Math.max(0, Number(v) || 0) : undefined; }));
    new Setting(contentEl).addButton((button) => button.setButtonText('Cancel').onClick(() => { this.done(null); this.close(); }));
    new Setting(contentEl).addButton((button) => button.setCta().setButtonText('Save').onClick(() => {
      if (!this.value.food) return;
      this.done(this.value);
      this.close();
    }));
  }
  onClose(): void { this.contentEl.empty(); }
}

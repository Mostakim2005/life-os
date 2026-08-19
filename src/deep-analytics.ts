import { App } from 'obsidian';
import { collectRecordsCached, listCachedDailyDates } from './performance';
import { DailyRecord, LifeOSSettings } from './types';

export interface NutritionAnalytics {
  meals: number;
  servings: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  byCategory: Record<string, { meals: number; servings: number; proteinG: number; calories: number }>;
  topFoods: { food: string; servings: number; proteinG: number; calories: number }[];
}

export interface ExerciseAnalytics {
  sessions: number;
  minutes: number;
  totalVolumeKg: number;
  distanceKm: number;
  averageIntensity: number;
  byCategory: Record<string, { sessions: number; minutes: number; volumeKg: number }>;
  byMuscle: Record<string, { sessions: number; minutes: number; volumeKg: number }>;
  topExercises: { name: string; sessions: number; minutes: number; volumeKg: number }[];
}

export interface DeepAnalyticsSnapshot {
  nutrition: NutritionAnalytics;
  exercise: ExerciseAnalytics;
  daily: { date: string; studyMinutes: number; exerciseMinutes: number; calories: number; proteinG: number; prayerPct: number; taskPct: number }[];
}

export async function calculateDeepAnalytics(app: App, settings: LifeOSSettings, from: string, to: string): Promise<DeepAnalyticsSnapshot> {
  const dates = listCachedDailyDates(app, settings, from, to);
  const records = await collectRecordsCached(app, settings, dates);
  return calculateDeepAnalyticsFromRecords(records);
}

export function calculateDeepAnalyticsFromRecords(records: DailyRecord[]): DeepAnalyticsSnapshot {
  const nutrition: NutritionAnalytics = { meals: 0, servings: 0, calories: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0, byCategory: {}, topFoods: [] };
  const foodMap = new Map<string, { food: string; servings: number; proteinG: number; calories: number }>();
  const exercise: ExerciseAnalytics = { sessions: 0, minutes: 0, totalVolumeKg: 0, distanceKm: 0, averageIntensity: 0, byCategory: {}, byMuscle: {}, topExercises: [] };
  const exerciseMap = new Map<string, { name: string; sessions: number; minutes: number; volumeKg: number }>();
  let intensitySum = 0, intensityCount = 0;
  const daily = records.map((record) => {
    let dayCalories = 0, dayProtein = 0;
    for (const meal of record.meals) {
      const servings = meal.servings ?? 1;
      const calories = meal.estimatedCalories ?? 0;
      const protein = meal.estimatedProteinG ?? 0;
      const carbs = meal.estimatedCarbsG ?? 0;
      const fat = meal.estimatedFatG ?? 0;
      const fiber = meal.estimatedFiberG ?? 0;
      nutrition.meals++; nutrition.servings += servings;
      nutrition.calories += calories; nutrition.proteinG += protein; nutrition.carbsG += carbs; nutrition.fatG += fat; nutrition.fiberG += fiber;
      dayCalories += calories; dayProtein += protein;
      const category = nutrition.byCategory[meal.category] ?? { meals: 0, servings: 0, proteinG: 0, calories: 0 };
      category.meals++; category.servings += servings; category.proteinG += protein; category.calories += calories;
      nutrition.byCategory[meal.category] = category;
      const foodKey = meal.food.trim() || 'Unknown';
      const top = foodMap.get(foodKey) ?? { food: foodKey, servings: 0, proteinG: 0, calories: 0 };
      top.servings += servings; top.proteinG += protein; top.calories += calories; foodMap.set(foodKey, top);
    }
    for (const item of record.exercises) {
      const volumeKg = (item.sets ?? 0) * (item.reps ?? 0) * (item.loadKg ?? 0);
      exercise.sessions++; exercise.minutes += item.durationMin; exercise.totalVolumeKg += volumeKg; exercise.distanceKm += item.distanceKm ?? 0;
      if (item.intensity !== undefined) { intensitySum += item.intensity; intensityCount++; }
      const category = exercise.byCategory[item.category] ?? { sessions: 0, minutes: 0, volumeKg: 0 };
      category.sessions++; category.minutes += item.durationMin; category.volumeKg += volumeKg; exercise.byCategory[item.category] = category;
      if (item.muscleGroup) { const muscle = exercise.byMuscle[item.muscleGroup] ?? { sessions: 0, minutes: 0, volumeKg: 0 }; muscle.sessions++; muscle.minutes += item.durationMin; muscle.volumeKg += volumeKg; exercise.byMuscle[item.muscleGroup] = muscle; }
      const key = item.name.trim() || 'Unknown'; const top = exerciseMap.get(key) ?? { name: key, sessions: 0, minutes: 0, volumeKg: 0 }; top.sessions++; top.minutes += item.durationMin; top.volumeKg += volumeKg; exerciseMap.set(key, top);
    }
    const prayerDenominator = record.prayers.filter((p) => p.status !== 'not-tracked').length;
    const prayerPct = prayerDenominator ? (record.prayers.filter((p) => p.status === 'completed').length / prayerDenominator) * 100 : 0;
    const taskPct = record.tasksPlanned.length ? (record.tasksCompleted.filter((t) => record.tasksPlanned.includes(t)).length / record.tasksPlanned.length) * 100 : 0;
    return { date: record.date, studyMinutes: record.studySessions.reduce((n, s) => n + s.durationMin, 0), exerciseMinutes: record.exercises.reduce((n, e) => n + e.durationMin, 0), calories: dayCalories, proteinG: dayProtein, prayerPct: Math.round(prayerPct), taskPct: Math.round(taskPct) };
  });
  nutrition.topFoods = [...foodMap.values()].sort((a, b) => b.servings - a.servings).slice(0, 12);
  exercise.averageIntensity = intensityCount ? Number((intensitySum / intensityCount).toFixed(1)) : 0;
  exercise.topExercises = [...exerciseMap.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 12);
  return { nutrition, exercise, daily };
}

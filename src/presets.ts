import { ExerciseEntry, HabitDefinition, MealEntry } from './types';

export interface FoodPreset {
  name: string;
  category: MealEntry['category'];
  affordable: boolean;
  commonInBangladesh: boolean;
  proteinGPer100g?: number;
  caloriesPer100g?: number;
  carbsGPer100g?: number;
  fatGPer100g?: number;
  fiberGPer100g?: number;
  tags: string[];
}

export const FOOD_PRESETS: FoodPreset[] = [
  { name: 'Egg', category: 'muscle', affordable: true, commonInBangladesh: true, proteinGPer100g: 13, caloriesPer100g: 143, carbsGPer100g: 1.1, fatGPer100g: 9.5, fiberGPer100g: 0, tags: ['protein', 'breakfast'] },
  { name: 'Lentils (dal)', category: 'budget', affordable: true, commonInBangladesh: true, proteinGPer100g: 9, caloriesPer100g: 116, carbsGPer100g: 20, fatGPer100g: 0.4, fiberGPer100g: 7.9, tags: ['protein', 'fiber'] },
  { name: 'Chickpeas (chola)', category: 'budget', affordable: true, commonInBangladesh: true, proteinGPer100g: 19, caloriesPer100g: 164, carbsGPer100g: 27, fatGPer100g: 2.6, fiberGPer100g: 7.6, tags: ['protein', 'fiber'] },
  { name: 'Soy chunks', category: 'muscle', affordable: true, commonInBangladesh: true, proteinGPer100g: 52, caloriesPer100g: 345, carbsGPer100g: 33, fatGPer100g: 0.5, fiberGPer100g: 13, tags: ['high-protein', 'budget'] },
  { name: 'Milk', category: 'muscle', affordable: true, commonInBangladesh: true, proteinGPer100g: 3.3, caloriesPer100g: 61, carbsGPer100g: 4.8, fatGPer100g: 3.3, tags: ['protein', 'calcium'] },
  { name: 'Plain yogurt / doi', category: 'health', affordable: true, commonInBangladesh: true, proteinGPer100g: 3.5, caloriesPer100g: 61, carbsGPer100g: 4.7, fatGPer100g: 3.3, tags: ['probiotic', 'calcium'] },
  { name: 'Peanuts', category: 'muscle', affordable: true, commonInBangladesh: true, proteinGPer100g: 26, caloriesPer100g: 567, carbsGPer100g: 16, fatGPer100g: 49, fiberGPer100g: 8.5, tags: ['protein', 'healthy-fat'] },
  { name: 'Banana', category: 'stamina', affordable: true, commonInBangladesh: true, caloriesPer100g: 89, carbsGPer100g: 23, fatGPer100g: 0.3, fiberGPer100g: 2.6, tags: ['carbohydrate', 'potassium'] },
  { name: 'Rice', category: 'stamina', affordable: true, commonInBangladesh: true, caloriesPer100g: 130, carbsGPer100g: 28, fatGPer100g: 0.3, fiberGPer100g: 0.4, tags: ['carbohydrate', 'energy'] },
  { name: 'Potato', category: 'stamina', affordable: true, commonInBangladesh: true, caloriesPer100g: 77, carbsGPer100g: 17, fatGPer100g: 0.1, fiberGPer100g: 2.2, tags: ['carbohydrate', 'potassium'] },
  { name: 'Chicken', category: 'muscle', affordable: true, commonInBangladesh: true, proteinGPer100g: 27, caloriesPer100g: 165, fatGPer100g: 3.6, tags: ['protein'] },
  { name: 'Small fish / local fish', category: 'health', affordable: true, commonInBangladesh: true, proteinGPer100g: 20, caloriesPer100g: 140, fatGPer100g: 6, tags: ['protein', 'fish'] },
  { name: 'Seasonal vegetables', category: 'health', affordable: true, commonInBangladesh: true, tags: ['fiber', 'micronutrients'] },
  { name: 'Guava', category: 'health', affordable: true, commonInBangladesh: true, caloriesPer100g: 68, carbsGPer100g: 14, fatGPer100g: 1, fiberGPer100g: 5.4, tags: ['vitamin-c', 'fiber'] },
  { name: 'Papaya', category: 'health', affordable: true, commonInBangladesh: true, caloriesPer100g: 43, carbsGPer100g: 11, fatGPer100g: 0.3, fiberGPer100g: 1.7, tags: ['fiber', 'vitamins'] },
  { name: 'Peanuts + chola snack', category: 'budget', affordable: true, commonInBangladesh: true, proteinGPer100g: 20, tags: ['snack', 'protein'] },
  { name: 'Oats', category: 'stamina', affordable: true, commonInBangladesh: true, proteinGPer100g: 13, caloriesPer100g: 389, carbsGPer100g: 66, fatGPer100g: 7, fiberGPer100g: 10.6, tags: ['breakfast', 'fiber'] },
  { name: 'Whole-wheat roti', category: 'stamina', affordable: true, commonInBangladesh: true, proteinGPer100g: 9, caloriesPer100g: 250, carbsGPer100g: 50, fatGPer100g: 3.5, fiberGPer100g: 6, tags: ['carbohydrate', 'fiber'] }
];

export const EXERCISE_PRESETS: ExerciseEntry[] = [
  { name: 'Brisk walking', category: 'cardio', durationMin: 30 },
  { name: 'Running', category: 'cardio', durationMin: 30 },
  { name: 'Cycling', category: 'cardio', durationMin: 30 },
  { name: 'Jump rope', category: 'cardio', durationMin: 15 },
  { name: 'Push-ups', category: 'strength', durationMin: 10 },
  { name: 'Squats', category: 'strength', durationMin: 10 },
  { name: 'Lunges', category: 'strength', durationMin: 10 },
  { name: 'Pull-ups', category: 'strength', durationMin: 10 },
  { name: 'Bench press', category: 'strength', durationMin: 15 },
  { name: 'Rows', category: 'strength', durationMin: 15 },
  { name: 'Plank', category: 'strength', durationMin: 10 },
  { name: 'Stretching', category: 'mobility', durationMin: 15 },
  { name: 'Yoga', category: 'mobility', durationMin: 30 },
  { name: 'Football', category: 'sport', durationMin: 60 },
  { name: 'Cricket', category: 'sport', durationMin: 90 },
  { name: 'Swimming', category: 'cardio', durationMin: 45 }
];

export const DEFAULT_HABITS: HabitDefinition[] = [
  { id: 'exercise', name: 'Exercise', icon: '🏋️', type: 'duration', target: 30, unit: 'min', enabled: true },
  { id: 'study', name: 'Study', icon: '📚', type: 'duration', target: 120, unit: 'min', enabled: true },
  { id: 'reading', name: 'Reading', icon: '📖', type: 'duration', target: 20, unit: 'min', enabled: true },
  { id: 'water', name: 'Water', icon: '💧', type: 'quantity', target: 2, unit: 'L', enabled: true },
  { id: 'quran', name: 'Quran / spiritual study', icon: '📿', type: 'duration', target: 15, unit: 'min', enabled: true },
  { id: 'tidy', name: 'Room tidy', icon: '🧹', type: 'subtasks', subtasks: ['Bed', 'Desk', 'Floor'], enabled: true },
  { id: 'screen-limit', name: 'Screen discipline', icon: '📵', type: 'points', target: 3, unit: 'points', enabled: true }
];

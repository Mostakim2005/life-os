import { App } from 'obsidian';
import { calculateStats } from './analytics';
import { Goal, GoalMetric, LifeOSSettings, Priority } from './types';

export const DEFAULT_GOALS: Goal[] = [];

export function metricLabel(metric: GoalMetric): string {
  return ({
    manual: 'Manual progress',
    'task-completion': 'Task completion %',
    'habit-consistency': 'Habit consistency %',
    'study-minutes': 'Study minutes',
    'exercise-minutes': 'Exercise minutes',
    'prayer-completion': 'Prayer completion %'
  } as Record<GoalMetric, string>)[metric];
}

export function priorityWeight(priority: Priority): number {
  return ({ low: 1, medium: 2, high: 4, critical: 7 } as Record<Priority, number>)[priority];
}

export async function currentGoalProgress(app: App, settings: LifeOSSettings, goal: Goal, from: string, to: string): Promise<number> {
  if (goal.metric === 'manual') return goal.current;
  const stats = await calculateStats(app, settings, from, to);
  if (goal.metric === 'task-completion') return stats.taskCompletionPct;
  if (goal.metric === 'habit-consistency') return stats.habitCompletionPct;
  if (goal.metric === 'study-minutes') return stats.studyMinutes;
  if (goal.metric === 'exercise-minutes') return stats.exerciseMinutes;
  return stats.prayerCompletionPct;
}

export function priorityFromDeadline(goal: Goal, today: string): number {
  const base = priorityWeight(goal.priority);
  if (!goal.deadline) return base;
  const days = Math.ceil((new Date(`${goal.deadline}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime()) / 86400000);
  if (days <= 0) return base + 8;
  if (days <= 3) return base + 5;
  if (days <= 7) return base + 3;
  return base;
}

export function goalProgressPct(goal: Goal, value = goal.current): number {
  return goal.target > 0 ? Math.min(100, Math.round((value / goal.target) * 100)) : 0;
}

export function createGoal(partial: Partial<Goal>): Goal {
  return {
    id: partial.id ?? `goal:${Date.now()}`,
    title: partial.title ?? 'New goal',
    description: partial.description,
    category: partial.category,
    priority: partial.priority ?? 'medium',
    status: partial.status ?? 'active',
    metric: partial.metric ?? 'manual',
    target: partial.target ?? 100,
    current: partial.current ?? 0,
    unit: partial.unit,
    deadline: partial.deadline,
    weeklyTarget: partial.weeklyTarget,
    estimatedMinutesPerWeek: partial.estimatedMinutesPerWeek,
    protectedTime: partial.protectedTime ?? false
  };
}

export async function refreshAutoGoals(app: App, settings: LifeOSSettings, from: string, to: string): Promise<Goal[]> {
  const goals = settings.goals.map((goal) => ({ ...goal }));
  for (const goal of goals) {
    if (goal.metric === 'manual') continue;
    goal.current = await currentGoalProgress(app, settings, goal, from, to);
    if (goal.target > 0 && goal.current >= goal.target) goal.status = 'completed';
  }
  return goals;
}

export function saveGoals(settings: LifeOSSettings, goals: Goal[]): void {
  settings.goals = goals;
}

export function deleteGoal(settings: LifeOSSettings, id: string): void {
  settings.goals = settings.goals.filter((goal) => goal.id !== id);
}

export function goalSummary(goal: Goal): string {
  const progress = goalProgressPct(goal);
  const deadline = goal.deadline ? ` · due ${goal.deadline}` : '';
  return `${progress}% · ${metricLabel(goal.metric)}${goal.unit ? ` · ${goal.unit}` : ''}${deadline}`;
}

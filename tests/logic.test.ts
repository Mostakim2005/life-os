import test from 'node:test';
import assert from 'node:assert/strict';
import { getConflicts, generatedEntries, mergedTimeline } from '../src/planning';
import { adaptiveSuggestions, freeWindows } from '../src/scheduling';
import { calculatePrayerTimes } from '../src/prayer-times';
import { isIsoDate, isTime, sanitizeDailyRecord } from '../src/record-validation';
import { DailyRecord, LifeOSSettings, PlanningRule } from '../src/types';

const settings = {
  planningRules: [],
  planningOverrides: {}
} as unknown as LifeOSSettings;

function record(date = '2026-08-19'): DailyRecord {
  return {
    schemaVersion: 3, date, mood: 3, energy: 3, sleepHours: 7, restMinutes: 30,
    prayers: [], habits: {}, exercises: [], meals: [], studySessions: [], studyPlan: [],
    timeline: [], tasksPlanned: [], tasksCompleted: [], optionalTasks: [], richTasks: [], richStudyPlans: [],
    reflection: '', notePath: `Life OS/Daily/${date}.md`, updatedAt: new Date().toISOString()
  };
}

test('generated recurrence uses only the requested date and its override', () => {
  const rule: PlanningRule = {
    id: 'study-1', name: 'Study', kind: 'study', recurrence: 'daily',
    startTime: '18:00', endTime: '19:00', optional: false, enabled: true
  };
  settings.planningRules = [rule];
  settings.planningOverrides = { 'study-1:2026-08-19': { date: '2026-08-19', start: '19:00', end: '20:00' } };
  const entries = generatedEntries(settings, '2026-08-19');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].start, '19:00');
  assert.equal(generatedEntries(settings, '2026-08-20')[0].start, '18:00');
});

test('merged timeline does not duplicate recurring entries', () => {
  const r = record();
  r.timeline.push({ id: 'rule:study-1:2026-08-19', title: 'Old', start: '18:00', end: '19:00', type: 'study', planned: true, actual: false });
  settings.planningRules = [{ id: 'study-1', name: 'Study', kind: 'study', recurrence: 'daily', startTime: '18:00', endTime: '19:00', optional: false, enabled: true }];
  const entries = mergedTimeline(r, generatedEntries(settings, r.date));
  assert.equal(entries.length, 1);
});

test('conflicts are detected without false positives', () => {
  const entries = [
    { id: 'a', title: 'A', start: '09:00', end: '10:00', type: 'study' as const, planned: true, actual: false },
    { id: 'b', title: 'B', start: '09:30', end: '10:30', type: 'task' as const, planned: true, actual: false },
    { id: 'c', title: 'C', start: '11:00', end: '12:00', type: 'rest' as const, planned: true, actual: false }
  ];
  assert.equal(getConflicts(entries).length, 1);
});

test('free windows and adaptive suggestions remain bounded to 24 hours', () => {
  const entries = [{ id: 'a', title: 'A', start: '08:00', end: '10:00', type: 'study' as const, planned: true, actual: false }];
  const windows = freeWindows(entries, 30);
  assert.ok(windows.some((window) => window.start === '10:00'));
  const suggestions = adaptiveSuggestions(entries, 60, 9 * 60);
  assert.ok(suggestions.length > 0);
  assert.ok(suggestions.every((suggestion) => suggestion.start >= '00:00' && suggestion.end <= '24:00'));
});

test('prayer calculation returns all five core prayers', () => {
  const result = calculatePrayerTimes({ date: '2026-08-19', latitude: 23.8103, longitude: 90.4125, method: 'karachi', madhab: 'hanafi', minuteAdjustment: 0 });
  for (const key of ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']) assert.match(result[key], /^\d{2}:\d{2}$/);
});

test('record validation accepts portable date/time and clamps unsafe values', () => {
  assert.equal(isIsoDate('2026-08-19'), true);
  assert.equal(isIsoDate('bad'), false);
  assert.equal(isTime('23:59'), true);
  assert.equal(isTime('99:99'), false);
  const defaults = record();
  const sanitized = sanitizeDailyRecord({ mood: 99, sleepHours: -4, timeline: [{ id: 'x', title: 'x', start: '25:00', end: '26:00', type: 'study', planned: true, actual: false }] }, defaults.date, defaults.notePath, defaults);
  assert.equal(sanitized.mood, 5);
  assert.equal(sanitized.sleepHours, 0);
  assert.equal(sanitized.timeline.length, 0);
});

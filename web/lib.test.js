import { describe, it, expect } from 'vitest';
import { courseCode, dueDay, dueLabel, urgencyClass, weekBucket } from './lib.js';

// Monday 28 Sep 2026, 3 PM local.
const NOW = new Date(2026, 8, 28, 15, 0);
const at = (d, h = 0, m = 0) => new Date(2026, 8, d, h, m).toISOString();

describe('courseCode', () => {
  it('shortens Canvas course names', () => {
    expect(courseCode('CS-475-001')).toBe('CS475');
    expect(courseCode('HNRS-360-008')).toBe('HNRS360');
    expect(courseCode('CS475-001 Fall 2026')).toBe('CS475');
  });

  it('leaves non-course names alone', () => {
    expect(courseCode('Required Student Trainings')).toBe('Required Student Trainings');
    expect(courseCode(null)).toBeNull();
  });
});

describe('dueDay', () => {
  it('counts a midnight deadline as the end of the previous day', () => {
    expect(dueDay(at(30)).getDate()).toBe(29);
  });

  it('keeps other times on their own day', () => {
    expect(dueDay(at(30, 23, 59)).getDate()).toBe(30);
  });
});

describe('dueLabel', () => {
  it('says today / tomorrow / weekday / date', () => {
    expect(dueLabel(at(28, 23, 59), NOW)).toMatch(/^Today, 11:59\sPM$/);
    expect(dueLabel(at(29, 17, 0), NOW)).toMatch(/^Tomorrow, 5:00\sPM$/);
    expect(dueLabel(at(1 + 30, 9, 0), NOW)).toMatch(/^Thursday, 9:00\sAM$/);
    expect(dueLabel(at(12 + 30, 9, 0), NOW)).toBe('Mon, Oct 12');
  });

  it('shows midnight deadlines on the day they end', () => {
    expect(dueLabel(at(30), NOW)).toBe('Tomorrow, midnight');
  });
});

describe('urgencyClass', () => {
  it('grades by time left', () => {
    expect(urgencyClass(at(29, 9), NOW)).toBe('urgent');
    expect(urgencyClass(at(30, 18), NOW)).toBe('soon');
    expect(urgencyClass(at(5 + 30), NOW)).toBe('');
  });
});

describe('weekBucket', () => {
  it('splits into this week (through Sunday), next week, later', () => {
    expect(weekBucket(at(28 + 6, 12), NOW)).toBe('This week'); // Sun 4 Oct
    expect(weekBucket(at(28 + 7, 12), NOW)).toBe('Next week'); // Mon 5 Oct
    expect(weekBucket(at(28 + 13, 12), NOW)).toBe('Next week'); // Sun 11 Oct
    expect(weekBucket(at(28 + 14, 12), NOW)).toBe('Later');
  });

  it('puts a Monday-midnight deadline in the week it ends', () => {
    expect(weekBucket(at(28 + 7), NOW)).toBe('This week');
  });
});

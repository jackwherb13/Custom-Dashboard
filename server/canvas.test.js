import { describe, it, expect } from 'vitest';
import { parseIcs, createDeadlines } from './canvas.js';

const ics = (...events) => [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  ...events.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']),
  'END:VCALENDAR',
].join('\r\n');

describe('parseIcs', () => {
  it('parses Canvas assignment events with direct assignment and course links', () => {
    const [e] = parseIcs(ics([
      'UID:event-assignment-123',
      'SUMMARY:Lab 1 [CS475-001 Fall 2026]',
      'DTSTART:20260927T035900Z',
      // Canvas links to the calendar and ends the line with a space.
      'URL;VALUE=URI:https://canvas.example.edu/calendar?include_contexts=course_86095&month=09&year=2026#assignment_123 ',
    ]));
    expect(e).toEqual({
      id: 'event-assignment-123',
      title: 'Lab 1',
      course: 'CS475-001 Fall 2026',
      due: '2026-09-27T03:59:00.000Z',
      url: 'https://canvas.example.edu/courses/86095/assignments/123',
      courseUrl: 'https://canvas.example.edu/courses/86095',
      kind: 'assignment',
    });
  });

  it('keeps the calendar link when there is no course to link to', () => {
    const [e] = parseIcs(ics([
      'UID:event-calendar-event-5',
      'SUMMARY:Office hours',
      'DTSTART:20261010T140000Z',
      'URL;VALUE=URI:https://canvas.example.edu/calendar?include_contexts=user_9#calendar_event_5',
    ]));
    expect(e.url).toBe('https://canvas.example.edu/calendar?include_contexts=user_9#calendar_event_5');
    expect(e.courseUrl).toBeNull();
  });

  it('unfolds continuation lines and unescapes text', () => {
    const [e] = parseIcs(ics([
      'UID:event-calendar-event-9',
      'SUMMARY:Midterm\\, part 1\\; room B [CS46',
      ' 8-001]',
      'DTSTART:20261010T140000Z',
    ]));
    expect(e.title).toBe('Midterm, part 1; room B');
    expect(e.course).toBe('CS468-001');
    expect(e.kind).toBe('event');
    expect(e.url).toBeNull();
  });

  it('handles all-day and local-time dates', () => {
    const [allDay, local] = parseIcs(ics(
      ['UID:a', 'SUMMARY:Holiday', 'DTSTART;VALUE=DATE:20261012'],
      ['UID:b', 'SUMMARY:Quiz', 'DTSTART;TZID=America/New_York:20261013T235900'],
    ));
    expect(allDay.due).toBe(new Date(2026, 9, 12).toISOString());
    expect(allDay.course).toBeNull();
    expect(local.due).toBe(new Date(2026, 9, 13, 23, 59).toISOString());
  });

  it('skips events without a date', () => {
    expect(parseIcs(ics(['UID:x', 'SUMMARY:No date']))).toEqual([]);
  });
});

describe('createDeadlines', () => {
  const NOW = new Date('2026-09-28T12:00:00Z');
  const feed = ics(
    ['UID:past', 'SUMMARY:Old [C]', 'DTSTART:20260920T000000Z'],
    ['UID:late', 'SUMMARY:Far [C]', 'DTSTART:20261201T000000Z'],
    ['UID:soon2', 'SUMMARY:Second [C]', 'DTSTART:20261002T000000Z'],
    ['UID:soon1', 'SUMMARY:First [C]', 'DTSTART:20260929T000000Z'],
  );
  const fakeFetch = (body, ok = true) => {
    const calls = [];
    const fn = async (url) => {
      calls.push(url);
      return { ok, status: ok ? 200 : 500, text: async () => body };
    };
    return { fn, calls };
  };

  it('reports unconfigured when there is no feed URL', async () => {
    const get = createDeadlines({ url: undefined, fetch: fakeFetch('').fn });
    expect(await get()).toEqual({ configured: false, deadlines: [] });
  });

  it('returns upcoming deadlines within the window, soonest first', async () => {
    const get = createDeadlines({ url: 'https://x/feed.ics', fetch: fakeFetch(feed).fn, now: () => NOW });
    const { configured, deadlines } = await get();
    expect(configured).toBe(true);
    expect(deadlines.map((d) => d.id)).toEqual(['soon1', 'soon2']);
  });

  it('caches the feed between calls', async () => {
    const f = fakeFetch(feed);
    let t = NOW.getTime();
    const get = createDeadlines({ url: 'https://x/feed.ics', fetch: f.fn, now: () => new Date(t) });
    await get();
    t += 5 * 60000;
    await get();
    expect(f.calls).toHaveLength(1);
    t += 20 * 60000;
    await get();
    expect(f.calls).toHaveLength(2);
  });

  it('reports fetch failures without throwing', async () => {
    const get = createDeadlines({ url: 'https://x/feed.ics', fetch: fakeFetch('', false).fn, now: () => NOW });
    expect(await get()).toEqual({ configured: true, deadlines: [], error: 'Canvas feed returned HTTP 500' });
  });
});

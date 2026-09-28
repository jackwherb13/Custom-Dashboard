// Canvas deadlines from the calendar feed (Canvas → Calendar → "Calendar Feed" .ics URL).
const TTL = 15 * 60000;
const WINDOW = 30 * 86400000;

const unescape = (s) => s.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');

function parseDate(value) {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', utc] = m;
  // TZID times are read as local time; this server runs on the same machine as the browser.
  const date = utc
    ? new Date(Date.UTC(y, mo - 1, d, h, mi, s))
    : new Date(y, mo - 1, d, h, mi, s);
  return isNaN(date) ? null : date.toISOString();
}

// Canvas links every item to its calendar page; build the course and assignment pages instead.
function canvasLinks(url, uid) {
  const m = url?.match(/^(https?:\/\/[^/]+)\/calendar\?.*include_contexts=course_(\d+)/);
  if (!m) return { url: url ?? null, courseUrl: null };
  const courseUrl = `${m[1]}/courses/${m[2]}`;
  const assignment = uid?.match(/^event-assignment-(\d+)$/);
  return { url: assignment ? `${courseUrl}/assignments/${assignment[1]}` : url, courseUrl };
}

export function parseIcs(text) {
  // RFC 5545: a line starting with a space or tab continues the previous line.
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') cur = {};
    else if (line === 'END:VEVENT') {
      if (cur?.due) events.push(cur);
      cur = null;
    } else if (cur) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const name = line.slice(0, colon).split(';')[0];
      const value = line.slice(colon + 1).trim();
      if (name === 'UID') cur.uid = value;
      else if (name === 'SUMMARY') cur.summary = unescape(value);
      else if (name === 'URL') cur.url = value;
      else if (name === 'DTSTART') cur.due = parseDate(value);
    }
  }
  return events.map((e) => {
    // Canvas appends the course in brackets: "Lab 1 [CS475-001 Fall 2026]".
    const m = (e.summary ?? '').match(/^(.*?)\s*\[([^\]]+)\]$/);
    return {
      id: e.uid ?? `${e.summary}-${e.due}`,
      title: m ? m[1] : e.summary ?? '(untitled)',
      course: m ? m[2] : null,
      due: e.due,
      ...canvasLinks(e.url, e.uid),
      kind: e.uid?.includes('assignment') ? 'assignment' : 'event',
    };
  });
}

export function createDeadlines({ url, fetch = globalThis.fetch, now = () => new Date() }) {
  let cache = null;
  // `fresh` skips the cache (the Refresh button), so a just-posted assignment shows up right away.
  return async function getDeadlines({ fresh = false } = {}) {
    if (!url) return { configured: false, deadlines: [] };
    const t = now().getTime();
    if (fresh || !cache || t - cache.at > TTL) {
      try {
        const res = await fetch(url);
        if (!res.ok) return { configured: true, deadlines: [], error: `Canvas feed returned HTTP ${res.status}` };
        cache = { at: t, events: parseIcs(await res.text()) };
      } catch (e) {
        return { configured: true, deadlines: [], error: `Could not reach Canvas: ${e.message}` };
      }
    }
    const deadlines = cache.events
      .filter((e) => Date.parse(e.due) >= t && Date.parse(e.due) <= t + WINDOW)
      .sort((a, b) => a.due.localeCompare(b.due));
    return { configured: true, deadlines };
  };
}

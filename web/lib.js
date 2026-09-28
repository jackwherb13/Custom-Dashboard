export const DAY = 86400000;

export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const sameDay = (a, b) => a.toDateString() === b.toDateString();
const isMidnight = (d) => d.getHours() === 0 && d.getMinutes() === 0;
const time = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function timeAgo(iso, now = new Date()) {
  const mins = Math.round((now - Date.parse(iso)) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

// Canvas often sets due times to 12:00 AM, which is really the end of the day before.
export function dueDay(iso) {
  const d = new Date(iso);
  return startOfDay(isMidnight(d) ? new Date(d.getTime() - 60000) : d);
}

export function dueLabel(iso, now = new Date()) {
  const d = new Date(iso);
  const day = dueDay(iso);
  const t = isMidnight(d) ? 'midnight' : time(d);
  const today = startOfDay(now);
  const daysOut = Math.round((day - today) / DAY);
  if (daysOut === 0) return `Today, ${t}`;
  if (daysOut === 1) return `Tomorrow, ${t}`;
  if (daysOut < 7) return `${day.toLocaleDateString('en-US', { weekday: 'long' })}, ${t}`;
  return day.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function urgencyClass(iso, now = new Date()) {
  const left = Date.parse(iso) - now;
  return left < DAY ? 'urgent' : left < 3 * DAY ? 'soon' : '';
}

// Weeks run Monday to Sunday.
export function weekBucket(iso, now = new Date()) {
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weeks = Math.floor((dueDay(iso) - monday) / (7 * DAY));
  return weeks <= 0 ? 'This week' : weeks === 1 ? 'Next week' : 'Later';
}

// "CS-475-001" → "CS475"; anything that isn't a course code is returned as-is.
export const courseCode = (course) => course?.match(/^([A-Z]{2,4})[\s-]?(\d{3})/)?.slice(1).join('') ?? course;

// Classes first, then everything else alphabetically.
export const groupOrder = (a, b) => (a === 'Classes' ? -1 : b === 'Classes' ? 1 : a.localeCompare(b));

// Monday to Sunday of the week `offset` weeks from now.
export function weekDays(offset = 0, now = new Date()) {
  const monday = startOfDay(now);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

export function nextUp(deadlines, done) {
  return deadlines
    .filter((d) => !done.has(d.id))
    .sort((a, b) => a.due.localeCompare(b.due))[0] ?? null;
}

// Projects (not classes), most recently worked on first; finished ones last.
export function projectsByActivity(items) {
  const last = (i) => i.sessions[0]?.updated ?? '';
  return items
    .filter((i) => i.group !== 'Classes')
    .sort((a, b) => (a.status === 'done') - (b.status === 'done')
      || last(b).localeCompare(last(a))
      || a.title.localeCompare(b.title));
}

import { useEffect, useRef } from 'react';
import { DAY, startOfDay, sameDay, dueDay, dueLabel, urgencyClass, courseCode } from './lib.js';

/* The week behind (Claude activity) and the week ahead (Canvas deadlines), today in the middle. */
export default function Timeline({ sessions, deadlines, done, selected, onSelect }) {
  const today = startOfDay(new Date());
  const days = Array.from({ length: 15 }, (_, i) => new Date(today.getTime() + (i - 7) * DAY));
  const counts = days.map((d) => sessions.filter(({ s }) => sameDay(new Date(s.updated), d)).length);
  const max = Math.max(1, ...counts);

  // On narrow screens the strip scrolls; start it with today at the left edge.
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el.scrollWidth > el.clientWidth) el.scrollLeft = el.children[7].offsetLeft - el.offsetLeft;
  }, []);

  return (
    <div className="timeline" role="list" ref={ref}>
      {days.map((d, i) => {
        const isToday = i === 7;
        const past = i < 7;
        const due = deadlines.filter((x) => sameDay(dueDay(x.due), d));
        const isSel = selected && sameDay(selected, d);
        const label = (
          <>
            <span className="tl-weekday">{isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
            <span className="tl-date">{d.getDate()}</span>
          </>
        );
        return (
          <div key={i} role="listitem" className={`tl-day ${past ? 'past' : ''} ${isToday ? 'today' : ''} ${d.getDay() % 6 === 0 ? 'weekend' : ''}`}>
            {onSelect && (counts[i] > 0 || isToday)
              ? (
                <button className={`tl-head ${isSel ? 'selected' : ''}`} onClick={() => onSelect(isSel ? null : d)}
                  title={`${counts[i]} Claude session${counts[i] === 1 ? '' : 's'} — click to filter`}>
                  {label}
                </button>
              )
              : <div className="tl-head">{label}</div>}
            <div className="tl-body">
              {isToday && counts[i] > 0 && <span className="tl-today-count">{counts[i]} session{counts[i] === 1 ? '' : 's'} today</span>}
              {past
                ? counts[i] > 0 && <span className="tl-bar" style={{ height: `${(counts[i] / max) * 100}%` }}><span>{counts[i]}</span></span>
                : due.map((x) => (
                  <span key={x.id} className={`tl-due ${done.has(x.id) ? 'done' : urgencyClass(x.due)}`} title={`${x.title} — ${dueLabel(x.due)}`}>
                    <strong>{courseCode(x.course) ?? 'Event'}</strong>
                    {x.title}
                  </span>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

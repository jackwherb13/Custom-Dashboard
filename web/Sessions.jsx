import { Icon } from './icons.jsx';
import { timeAgo } from './lib.js';

export function SessionList({ entries, act, showItem = true }) {
  return (
    <ul className="session-list">
      {entries.map(({ s, item }) => (
        <li key={s.id}>
          <button className="resume" title="Resume in Windows Terminal"
            onClick={() => act({ action: 'resume', itemId: item.id, sessionId: s.id }, `Resuming “${s.title ?? s.firstPrompt}”`)}>
            <Icon name="play" size={12} />
          </button>
          <div className="session-text">
            <span className="session-title">{s.title ?? s.firstPrompt}</span>
            {s.title && <span className="session-prompt">{s.firstPrompt}</span>}
          </div>
          {showItem && <span className="session-item">{item.title}</span>}
          <span className="session-when">{timeAgo(s.updated)}</span>
        </li>
      ))}
    </ul>
  );
}

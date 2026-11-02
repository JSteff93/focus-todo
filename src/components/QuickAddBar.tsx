import { useEffect, useRef, useState } from 'react';
import type { Project, Recurrence, Status } from '../types';
import { findTodoStatus } from '../store';
import { getProjectSuggestions, parseQuickAdd } from '../utils/quickAdd';
import { PHONE_QUERY, useMediaQuery } from '../utils/useMediaQuery';

interface Props {
  projects: Project[];
  statuses: Status[];
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
}

const CONFIRM_MS = 1800;
const SYNTAX_HINT = '/project  #date  @mins  !notes';
const SHORTCUT_LABEL = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

function formatDue(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function isTypingElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// One-line task entry in the app header, shown on every view:
//   Send budget /Work #tomorrow @30 !use the Q3 template
// Always creates into To-Do. Parsing lives in utils/quickAdd.
export function QuickAddBar({ projects, statuses, addTask }: Props) {
  const [text, setText] = useState('');
  const [caret, setCaret] = useState(0);
  // Sampled on each edit rather than in render, so `#today` etc. resolve
  // against the moment the line was typed.
  const [now, setNow] = useState(() => Date.now());
  const [highlight, setHighlight] = useState(0);
  const [dropdownDismissed, setDropdownDismissed] = useState(false);
  // "Add a title" only shows after a failed Enter — it would otherwise flash
  // up the moment someone starts a line with a token.
  const [attempted, setAttempted] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  // Phones get a short placeholder; the token syntax moves into a hint
  // popover shown while the empty bar is focused.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); }, []);

  // Ctrl/Cmd+K jumps to the bar from anywhere — except while typing in
  // another field, where it's left to that field.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (e.target !== inputRef.current && isTypingElsewhere(e.target)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const parsed = parseQuickAdd(text, projects, new Date(now));
  const suggestions = dropdownDismissed ? null : getProjectSuggestions(text, caret, projects);
  const dropdownOpen = !!suggestions;
  const activeIndex = suggestions ? Math.min(highlight, suggestions.matches.length - 1) : 0;
  // While the dropdown is open the `/fragment` is still being typed, so its
  // "No project" error would only be noise.
  const visibleErrors = parsed.errors.filter(err =>
    (attempted || err !== 'Add a title') && !(dropdownOpen && err.startsWith('No project')));
  const project = parsed.projectId ? projects.find(p => p.id === parsed.projectId) : undefined;
  const hasChips = !!(project || parsed.dueDate || parsed.estimatedFocusMins || parsed.description);
  const showPanel = text.trim() !== '' && (hasChips || visibleErrors.length > 0) && !dropdownOpen;
  const showSyntaxHint = isPhone && focused && text === '';

  function syncCaret() {
    setCaret(inputRef.current?.selectionStart ?? text.length);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    setCaret(e.target.selectionStart ?? e.target.value.length);
    setNow(Date.now());
    setHighlight(0);
    setDropdownDismissed(false);
    setAttempted(false);
    setConfirmation(null);
  }

  function complete(name: string) {
    if (!suggestions) return;
    const next = `${text.slice(0, suggestions.start)}/${name} ${text.slice(suggestions.end).replace(/^\s+/, '')}`;
    const nextCaret = suggestions.start + name.length + 2;
    setText(next);
    setCaret(nextCaret);
    setHighlight(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function submit() {
    setAttempted(true);
    // Re-parse against the current moment — the line may have sat there
    // past midnight since it was typed.
    const result = parseQuickAdd(text, projects, new Date());
    if (result.errors.length > 0) return;
    const todo = findTodoStatus(statuses);
    if (!todo) return;
    addTask(todo.id, result.title, result.description, result.dueDate, undefined, undefined, result.projectId, result.estimatedFocusMins);
    setText('');
    setCaret(0);
    setAttempted(false);
    setConfirmation(`Added “${result.title}”`);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmation(null), CONFIRM_MS);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (dropdownOpen && suggestions) {
      const count = suggestions.matches.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((activeIndex + 1) % count); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((activeIndex - 1 + count) % count); return; }
      // Tab completes instead of moving focus out of the bar.
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); complete(suggestions.matches[activeIndex].name); return; }
      if (e.key === 'Escape') { e.preventDefault(); setDropdownDismissed(true); return; }
    }
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      setText('');
      setCaret(0);
      setAttempted(false);
    }
  }

  const noTodoStatus = statuses.length === 0;

  return (
    <div className="quick-add">
      <div className="quick-add-field">
        <span className="quick-add-icon" aria-hidden="true">+</span>
        <input
          ref={inputRef}
          className="quick-add-input"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onBlur={() => { setDropdownDismissed(true); setFocused(false); }}
          onFocus={() => { setDropdownDismissed(false); setFocused(true); }}
          placeholder={isPhone ? 'Add a task…' : `Add a task…  ${SYNTAX_HINT}`}
          aria-label="Quick add task"
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          aria-controls="quick-add-suggestions"
          aria-activedescendant={dropdownOpen ? `quick-add-suggestion-${activeIndex}` : undefined}
          aria-invalid={visibleErrors.length > 0 || undefined}
          disabled={noTodoStatus}
          spellCheck={false}
          autoComplete="off"
        />
        {confirmation ? (
          <span className="quick-add-confirm" role="status">✓ {confirmation}</span>
        ) : (
          <kbd className="quick-add-kbd" title="Jump here from anywhere">{SHORTCUT_LABEL}</kbd>
        )}
      </div>

      {dropdownOpen && suggestions && (
        <ul id="quick-add-suggestions" className="quick-add-popover quick-add-suggestions" role="listbox">
          {suggestions.matches.map((p, i) => (
            <li
              key={p.id}
              id={`quick-add-suggestion-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`quick-add-suggestion${i === activeIndex ? ' quick-add-suggestion--active' : ''}`}
              // mousedown, not click — click would land after the input's blur
              // has already closed the dropdown.
              onMouseDown={e => { e.preventDefault(); complete(p.name); }}
              onMouseEnter={() => setHighlight(i)}
            >
              <span className="quick-add-dot" style={{ background: p.color }} />
              {p.name}
            </li>
          ))}
          <li className="quick-add-suggestion-hint" aria-hidden="true">Tab to complete · Esc to close</li>
        </ul>
      )}

      {showSyntaxHint && (
        <p className="quick-add-popover quick-add-syntax-hint">{SYNTAX_HINT}</p>
      )}

      {showPanel && (
        <div className="quick-add-popover quick-add-preview" aria-live="polite">
          {hasChips && (
            <div className="quick-add-chips">
              {project && (
                <span className="quick-add-chip" style={{ color: project.color, borderColor: `${project.color}66`, background: `${project.color}1a` }}>
                  ● {project.name}
                </span>
              )}
              {parsed.dueDate && <span className="quick-add-chip">📅 {formatDue(parsed.dueDate)}</span>}
              {parsed.estimatedFocusMins && <span className="quick-add-chip">⏱ {formatMins(parsed.estimatedFocusMins)}</span>}
              {parsed.description && <span className="quick-add-chip quick-add-chip--notes" title={parsed.description}>📝 {parsed.description}</span>}
            </div>
          )}
          {visibleErrors.map(err => <p key={err} className="quick-add-error">⚠ {err}</p>)}
        </div>
      )}
    </div>
  );
}

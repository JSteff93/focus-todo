import { useId, useLayoutEffect, useRef, useState } from 'react';
import { TIME_STEP_MINS, minsToTime, nearestStepMins, nearestStepTime, parseTimeInput, stepMins, timeToMins } from '../utils/timeStep';

// Every 5-minute slot in the day, 00:00 … 23:55.
const SLOTS = Array.from({ length: (24 * 60) / TIME_STEP_MINS }, (_, i) => i * TIME_STEP_MINS);

interface Props {
  value: string; // `HH:MM`, or '' when empty
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
  id?: string;
}

// Replaces <input type="time">, whose desktop picker ignores `step` and lists
// every minute. The list offers 5-minute slots; typing keeps an exact minute
// (9:03, 903, 2:15pm …, see parseTimeInput), normalised to HH:MM on blur.
export function TimeField({ value, onChange, className, id, 'aria-label': ariaLabel }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  // Re-sync the text when the value changes from outside (or from a pick).
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }
  const listRef = useRef<HTMLUListElement>(null);
  // Whether the next scroll should centre the highlight (on open) or just
  // keep it in view (while arrowing).
  const centreRef = useRef(true);

  // The highlighted slot follows whatever's typed; with nothing usable it
  // starts at the current time. Sampled when the list opens, not each render.
  const [openedAt, setOpenedAt] = useState(() => Date.now());
  const typedMins = timeToMins(parseTimeInput(draft) ?? '');
  const highlightMins = typedMins !== null
    ? nearestStepMins(typedMins)
    : timeToMins(nearestStepTime(new Date(openedAt)))!;

  useLayoutEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!item) return;
    if (centreRef.current) {
      listRef.current.scrollTop = item.offsetTop - (listRef.current.clientHeight - item.offsetHeight) / 2;
      centreRef.current = false;
    } else {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlightMins]);

  function openList() {
    if (open) return;
    centreRef.current = true;
    setOpenedAt(Date.now());
    setOpen(true);
  }

  function commit(next: string) {
    setDraft(next);
    if (next !== value) onChange(next);
  }

  // Unreadable text reverts to the last good value rather than silently
  // saving something unexpected.
  function commitDraft() {
    if (draft.trim() === '') { commit(''); return; }
    commit(parseTimeInput(draft) ?? value);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      openList();
      const from = typedMins ?? highlightMins;
      // From empty the first press lands on the starting slot itself.
      commit(minsToTime(typedMins === null ? from : stepMins(from, e.key === 'ArrowUp' ? 1 : -1)));
    } else if (e.key === 'Enter') {
      if (!open) return;
      e.preventDefault();
      // Typed text wins (keeps 09:03 exact); only an empty field takes the
      // highlighted slot.
      if (draft.trim() === '') commit(minsToTime(highlightMins));
      else commitDraft();
      setOpen(false);
    } else if (e.key === 'Escape') {
      if (!open) return;
      // Close just the list, not whatever modal the field sits in.
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="time-field">
      <input
        id={id}
        className={className}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${highlightMins}` : undefined}
        autoComplete="off"
        placeholder="HH:MM"
        value={draft}
        onFocus={openList}
        onClick={openList}
        onChange={e => { setDraft(e.target.value); openList(); }}
        onBlur={() => { commitDraft(); setOpen(false); }}
        onKeyDown={onKeyDown}
      />
      {open && (
        <ul className="time-field-list" id={listId} role="listbox" ref={listRef}>
          {SLOTS.map(mins => (
            <li
              key={mins}
              id={`${listId}-${mins}`}
              role="option"
              aria-selected={mins === highlightMins}
              className={`time-field-option${mins === highlightMins ? ' time-field-option--active' : ''}`}
              // Keep focus in the input so blur doesn't commit the old draft
              // before the click lands.
              onMouseDown={e => e.preventDefault()}
              onClick={() => { commit(minsToTime(mins)); setOpen(false); }}
            >
              {minsToTime(mins)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

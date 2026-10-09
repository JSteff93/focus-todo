import { useState } from 'react';
import type { ActivitySeries, ActivityCategory, ActivitySlot, WeeklyRecurrence } from '../types';
import { CATEGORY_LABELS, SLOT_LABELS } from '../utils/fiveToNine';
import { WeekdayPicker } from './WeekdayPicker';

const CATEGORIES: ActivityCategory[] = ['exercise', 'chores', 'fun', 'social'];
const SLOTS: ActivitySlot[] = ['before', 'work', 'after'];

interface Props {
  activity?: ActivitySeries; // undefined = create mode
  defaultDate?: string;
  defaultSlot?: ActivitySlot;
  onSave: (title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ActivityDrawer({ activity, defaultDate, defaultSlot, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? 'exercise');
  const [slot, setSlot] = useState<ActivitySlot>(activity?.slot ?? defaultSlot ?? 'before');
  const [anchorDate, setAnchorDate] = useState(activity?.anchorDate ?? defaultDate ?? '');
  const [repeats, setRepeats] = useState(!!activity?.recurrence);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(activity?.recurrence?.daysOfWeek ?? [new Date().getDay()]);

  function submit() {
    if (!title.trim() || !anchorDate) return;
    onSave(title.trim(), category, slot, anchorDate, repeats ? { daysOfWeek } : undefined);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{activity ? 'Edit Activity' : 'New Activity'}</h2>

        <label className="form-label">Title</label>
        <input
          className="task-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Gym"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />

        <label className="form-label" style={{ marginTop: '1rem' }}>Category</label>
        <div className="category-picker">
          {CATEGORIES.map(c => (
            <button
              key={c}
              type="button"
              className={`category-pill${category === c ? ' category-pill--active' : ''}`}
              style={{ '--cat-color': `var(--cat-${c})` } as React.CSSProperties}
              onClick={() => setCategory(c)}
            >
              <span className="activity-category-dot" />
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>

        <label className="form-label" style={{ marginTop: '1rem' }}>Slot</label>
        <select className="task-input" value={slot} onChange={e => setSlot(e.target.value as ActivitySlot)}>
          {SLOTS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
        </select>

        {!activity && (
          <>
            <label className="form-label" style={{ marginTop: '1rem' }}>Date</label>
            <input
              className="task-input"
              type="date"
              value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)}
            />
          </>
        )}

        <div className="recurrence-picker" style={{ marginTop: '1rem' }}>
          <label className="recurrence-toggle-label">
            <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} />
            <span>Repeats weekly</span>
          </label>
          {repeats && (
            <div className="recurrence-body">
              <WeekdayPicker value={daysOfWeek} onChange={setDaysOfWeek} />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={submit} disabled={!title.trim() || !anchorDate}>
            {activity ? 'Save' : 'Add Activity'}
          </button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          {activity && onDelete && (
            <button className="btn btn--ghost" style={{ color: '#ef4444' }} onClick={() => { onDelete(); onClose(); }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}

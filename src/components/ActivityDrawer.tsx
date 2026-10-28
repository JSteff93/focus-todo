import { useState } from 'react';
import type { ActivitySeries, ActivityCategory, ActivityCategoryDef, ActivitySlot, WeeklyRecurrence } from '../types';
import { UNCATEGORISED, getSlotLabels, isWeekendDate } from '../utils/fiveToNine';
import { WeekdayPicker } from './WeekdayPicker';
const SLOTS: ActivitySlot[] = ['before', 'work', 'after'];

interface Props {
  activity?: ActivitySeries; // undefined = create mode
  defaultDate?: string;
  defaultSlot?: ActivitySlot;
  categories: ActivityCategoryDef[];
  onManageCategories: () => void;
  onSave: (title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ActivityDrawer({ activity, defaultDate, defaultSlot, categories, onManageCategories, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? categories[0]?.id ?? '');
  const [slot, setSlot] = useState<ActivitySlot>(activity?.slot ?? defaultSlot ?? 'before');
  const [anchorDate, setAnchorDate] = useState(activity?.anchorDate ?? defaultDate ?? '');
  const [repeats, setRepeats] = useState(!!activity?.recurrence);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(activity?.recurrence?.daysOfWeek ?? [new Date().getDay()]);

  // Weekend wording only when every day this activity lands on is a weekend
  // day; a series spanning weekdays keeps the work-day wording.
  const slotLabels = getSlotLabels(
    repeats
      ? daysOfWeek.length > 0 && daysOfWeek.every(d => d === 0 || d === 6)
      : !!anchorDate && isWeekendDate(anchorDate)
  );

  // The selected id can stop existing (deleted in the manager opened from
  // here, or an old dangling reference) — a new activity just falls back to
  // the first category; an existing one shows "Uncategorised" rather than
  // silently changing what it was saved with.
  const categoryExists = categories.some(c => c.id === category);
  const effectiveCategory = categoryExists || activity ? category : (categories[0]?.id ?? '');

  function submit() {
    if (!title.trim() || !anchorDate) return;
    onSave(title.trim(), effectiveCategory, slot, anchorDate, repeats ? { daysOfWeek } : undefined);
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
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              className={`category-pill${effectiveCategory === c.id ? ' category-pill--active' : ''}`}
              style={{ '--cat-color': c.color } as React.CSSProperties}
              onClick={() => setCategory(c.id)}
            >
              <span className="activity-category-dot" />
              {c.label}
            </button>
          ))}
          {!categories.some(c => c.id === effectiveCategory) && (
            <span className="category-pill category-pill--active" style={{ '--cat-color': UNCATEGORISED.color } as React.CSSProperties}>
              <span className="activity-category-dot" />
              {UNCATEGORISED.label}
            </span>
          )}
          <button type="button" className="category-pill category-pill--add" onClick={onManageCategories} title="Manage categories">
            + Manage
          </button>
        </div>

        <label className="form-label" style={{ marginTop: '1rem' }}>Slot</label>
        <select className="task-input" value={slot} onChange={e => setSlot(e.target.value as ActivitySlot)}>
          {SLOTS.map(s => <option key={s} value={s}>{slotLabels[s]}</option>)}
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

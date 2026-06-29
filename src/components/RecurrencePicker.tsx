import type { Recurrence } from '../types';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
  value: Recurrence | undefined;
  onChange: (rec: Recurrence | undefined) => void;
}

export function RecurrencePicker({ value, onChange }: Props) {
  const enabled = !!value;
  const unit = value?.unit ?? 'week';
  const interval = value?.interval ?? 1;
  const daysOfWeek = value?.daysOfWeek ?? [];

  function enable(on: boolean) {
    if (on) {
      const today = new Date().getDay();
      onChange({ unit: 'week', interval: 1, daysOfWeek: [today] });
    } else {
      onChange(undefined);
    }
  }

  function patch(updates: Partial<Recurrence>) {
    if (!value) return;
    onChange({ ...value, ...updates });
  }

  function setUnit(newUnit: Recurrence['unit']) {
    const base: Recurrence = { unit: newUnit, interval };
    if (newUnit === 'week') {
      base.daysOfWeek = daysOfWeek.length > 0 ? daysOfWeek : [new Date().getDay()];
    }
    onChange(base);
  }

  function toggleDay(day: number) {
    if (!value) return;
    const next = daysOfWeek.includes(day)
      ? daysOfWeek.filter(d => d !== day)
      : [...daysOfWeek, day];
    if (next.length === 0) return; // keep at least one
    patch({ daysOfWeek: next });
  }

  return (
    <div className="recurrence-picker">
      <label className="recurrence-toggle-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={e => enable(e.target.checked)}
        />
        <span>Repeats</span>
      </label>

      {enabled && (
        <div className="recurrence-body">
          <div className="recurrence-row">
            <span className="recurrence-text">Every</span>
            <input
              className="recurrence-interval"
              type="number"
              min={1}
              max={99}
              value={interval}
              onChange={e => patch({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
            />
            <select
              className="recurrence-unit"
              value={unit}
              onChange={e => setUnit(e.target.value as Recurrence['unit'])}
            >
              <option value="day">{interval === 1 ? 'Day' : 'Days'}</option>
              <option value="week">{interval === 1 ? 'Week' : 'Weeks'}</option>
              <option value="month">{interval === 1 ? 'Month' : 'Months'}</option>
            </select>
          </div>

          {unit === 'week' && (
            <div className="recurrence-days">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  className={`day-btn${daysOfWeek.includes(i) ? ' day-btn--on' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

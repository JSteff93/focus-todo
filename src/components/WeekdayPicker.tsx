const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

interface Props {
  value: number[];
  onChange: (days: number[]) => void;
}

export function WeekdayPicker({ value, onChange }: Props) {
  function toggleDay(day: number) {
    const next = value.includes(day) ? value.filter(d => d !== day) : [...value, day];
    if (next.length === 0) return; // keep at least one
    onChange(next);
  }

  return (
    <div className="recurrence-days">
      {DAY_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          className={`day-btn${value.includes(i) ? ' day-btn--on' : ''}`}
          onClick={() => toggleDay(i)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

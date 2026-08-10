import { useState } from 'react';

const PRESET_COLORS = [
  '#587f65', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

interface Props {
  onAdd: (label: string, color: string) => void;
  onClose: () => void;
}

export function AddStatusModal({ onAdd, onClose }: Props) {
  const [label, setLabel] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);

  function submit() {
    if (label.trim()) {
      onAdd(label.trim(), color);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Column</h2>
        <label className="form-label">Column name</label>
        <input
          className="task-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. In Review"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />
        <label className="form-label" style={{ marginTop: '1rem' }}>Color</label>
        <div className="color-grid">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              className={`color-swatch ${color === c ? 'color-swatch--active' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={submit} disabled={!label.trim()}>Add Column</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

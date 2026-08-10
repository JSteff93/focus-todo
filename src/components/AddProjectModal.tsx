import { useState } from 'react';

const PRESET_COLORS = [
  '#587f65', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444',
  '#3b82f6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

interface Props {
  onAdd: (name: string, color: string) => void;
  onClose: () => void;
}

export function AddProjectModal({ onAdd, onClose }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[2]);

  function submit() {
    if (name.trim()) {
      onAdd(name.trim(), color);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">New Project</h2>
        <label className="form-label">Project name</label>
        <input
          className="task-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Marketing"
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
          <button className="btn btn--primary" onClick={submit} disabled={!name.trim()}>Create Project</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

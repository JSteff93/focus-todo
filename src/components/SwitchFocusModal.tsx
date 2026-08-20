interface Props {
  currentTaskTitle: string;
  newTaskTitle: string;
  onContinue: () => void;
  onSwitch: () => void;
  onClose: () => void;
}

export function SwitchFocusModal({ currentTaskTitle, newTaskTitle, onContinue, onSwitch, onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Focus session in progress</h2>
        <p className="switch-focus-desc">
          You're already focusing on <strong>{currentTaskTitle}</strong>. What would you like to do?
        </p>
        <div className="switch-focus-actions">
          <button className="btn btn--ghost switch-focus-option" onClick={onContinue}>
            <span className="switch-focus-option-label">Continue current session</span>
            <span className="switch-focus-option-sub">{currentTaskTitle}</span>
          </button>
          <button className="btn btn--primary switch-focus-option" onClick={onSwitch}>
            <span className="switch-focus-option-label">Switch task</span>
            <span className="switch-focus-option-sub">{newTaskTitle}</span>
          </button>
        </div>
        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

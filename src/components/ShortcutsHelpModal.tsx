import { SHORTCUT_HELP_ROWS } from '../utils/keyboardShortcuts';

interface Props {
  onClose: () => void;
}

export function ShortcutsHelpModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-help-title"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <h2 className="modal-title" id="shortcuts-help-title">Keyboard shortcuts</h2>
        <p className="shortcuts-help-note">Press G, let go, then the letter.</p>
        <table className="shortcuts-help-table">
          <tbody>
            {SHORTCUT_HELP_ROWS.map(row => (
              <tr key={row.label}>
                <td className="shortcuts-help-keys">
                  {row.keys.map((k, i) => (
                    <span key={k}>
                      {i > 0 && <span className="shortcuts-help-then"> {row.keys[0] === 'G' ? 'then' : '+'} </span>}
                      <kbd>{k}</kbd>
                    </span>
                  ))}
                </td>
                <td>{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="modal-actions">
          <button className="btn btn--primary" onClick={onClose} autoFocus>Close</button>
        </div>
      </div>
    </div>
  );
}

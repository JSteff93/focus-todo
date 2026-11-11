import { dismissToast, useToasts } from '../lib/toast';

// Mounted once, outside <App>, so toasts survive the switch to the sign-in
// screen. The live region is always rendered: screen readers only announce
// changes to a region that already exists.
export function Toaster() {
  const toasts = useToasts();
  return (
    <div className="toaster" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.kind}`}>
          <p className="toast-message">{t.message}</p>
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>✕</button>
          {t.actions.length > 0 && (
            <div className="toast-actions">
              {t.actions.map(a => (
                <button
                  key={a.label}
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => { dismissToast(t.id); a.onClick(); }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

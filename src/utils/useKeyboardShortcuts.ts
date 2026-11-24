import { useEffect, useRef } from 'react';
import { createShortcutMatcher, isOverlayOpen, isTypingElsewhere, type View } from './keyboardShortcuts';

// App-wide view shortcuts (see VIEW_SHORTCUTS). Handlers are read through a
// ref so the listener is attached once and never goes stale.
export function useKeyboardShortcuts(handlers: { onView: (view: View) => void; onHelp: () => void }) {
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  useEffect(() => {
    const match = createShortcutMatcher();
    function onKeyDown(e: KeyboardEvent) {
      const { action, handled } = match({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        repeat: e.repeat,
        blocked: isTypingElsewhere(e.target) || isOverlayOpen(),
        time: e.timeStamp,
      });
      if (handled) e.preventDefault();
      if (action?.type === 'view') handlersRef.current.onView(action.view);
      else if (action?.type === 'help') handlersRef.current.onHelp();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

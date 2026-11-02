import { KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';

interface Options {
  // Pixels the mouse must travel before a drag starts, so clicks still click.
  distance?: number;
  // Arrow-key reordering, for sortable lists.
  keyboard?: boolean;
}

// Shared drag sensors for every DndContext. Mouse drags start after a small
// move, as before; touch drags need a press-and-hold so an ordinary swipe
// over a card scrolls the page instead of picking the card up.
export function useDndSensors({ distance = 5, keyboard = false }: Options = {}) {
  const mouse = useSensor(MouseSensor, { activationConstraint: { distance } });
  const touch = useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } });
  const keys = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates });
  return useSensors(mouse, touch, keyboard ? keys : null);
}

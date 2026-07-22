export type ProjectHistoryShortcut = 'redo' | 'undo';

const nonTextInputTypes = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }
  const contentEditable = target.closest('[contenteditable]');
  if (contentEditable !== null && contentEditable.getAttribute('contenteditable') !== 'false') {
    return true;
  }
  if (target instanceof HTMLTextAreaElement) {
    return true;
  }
  return target instanceof HTMLInputElement && !nonTextInputTypes.has(target.type);
}

export function projectHistoryShortcut(event: KeyboardEvent): ProjectHistoryShortcut | null {
  if (
    event.defaultPrevented ||
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey ||
    isTextEditingTarget(event.target)
  ) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === 'z') {
    return event.shiftKey ? 'redo' : 'undo';
  }
  if (key === 'y' && !event.shiftKey) {
    return 'redo';
  }
  return null;
}

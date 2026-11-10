/**
 * The glyph of a pinnable side list's toggle: unpin while pinned beside the content, open
 * while closed, pin while open. Too narrow to pin, the list only opens and closes: no pin glyph.
 */
export function pinToggleGlyph(state: {
  readonly pinned: boolean;
  readonly open: boolean;
  readonly autoFolded: boolean;
}): string {
  if (state.pinned) return '⇤';
  return !state.open || state.autoFolded ? '☰' : '⇥';
}

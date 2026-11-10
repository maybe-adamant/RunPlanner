import type { ReactNode } from 'react';
import { hintProps } from './hint';

/**
 * A word or value a note explains: the note shows on hover or keyboard focus and is its
 * accessible description; without a note, the text alone.
 */
export function NotedText({
  children,
  label,
  note,
}: {
  readonly children: ReactNode;
  /** The text's own words, its accessible name. */
  readonly label: string;
  readonly note: string | undefined;
}) {
  if (note === undefined) return children;
  return (
    <span
      {...hintProps(note, undefined, label)}
      aria-label={label}
      className="noted-text"
      role="group"
      tabIndex={0}
    >
      {children}
    </span>
  );
}

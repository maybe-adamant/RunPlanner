import type { HomeContextPart } from '@planner/projections/homeContext';

/**
 * A panel's context: after its name, each part led by " · "; or, where a narrow panel has no
 * room on its name's line, on a line of its own.
 */
export function HomeContext({
  ownLine = false,
  parts,
}: {
  readonly ownLine?: boolean;
  readonly parts: readonly HomeContextPart[];
}) {
  if (parts.length === 0) return null;
  return (
    <span className="home-context" data-own-line={ownLine || undefined}>
      {parts.map((part, position) => (
        <span key={part.text}>
          {ownLine && position === 0 ? null : ' · '}
          <span data-tone={part.tone ?? undefined}>{part.text}</span>
        </span>
      ))}
    </span>
  );
}

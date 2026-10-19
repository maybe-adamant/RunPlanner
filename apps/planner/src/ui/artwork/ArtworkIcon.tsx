/** One icon, or a pair drawn as two overlapping halves of the same slot. */
export type ArtworkSource = string | readonly [string | undefined, string | undefined];

/** An icon slot that stays the same size when its icon is missing. */
export function ArtworkIcon({
  className,
  source,
}: {
  readonly className: string;
  readonly source: ArtworkSource | undefined;
}) {
  if (source === undefined) return <span className={className} aria-hidden="true" />;
  if (typeof source === 'string') return <img src={source} alt="" className={className} />;
  return (
    <span className={`${className} artwork-pair`} aria-hidden="true">
      {source.map((part, index) =>
        part === undefined ? (
          <span className="artwork-pair-part" key={index} />
        ) : (
          <img src={part} alt="" className="artwork-pair-part" key={index} />
        ),
      )}
    </span>
  );
}

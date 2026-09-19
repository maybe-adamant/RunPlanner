import type { ButtonHTMLAttributes } from 'react';
import { fearArtwork } from './fearArtwork';

export function FearCard({
  vowKey,
  label,
  rank,
  maximum,
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly vowKey: string;
  readonly label: string;
  readonly rank?: number;
  readonly maximum?: number;
}) {
  return (
    <button
      {...button}
      type="button"
      className="fear-rank-control"
      data-fear-vow-key={vowKey}
      data-rival={vowKey === 'BossDifficultyShrineUpgrade' || undefined}
      data-active={(rank === undefined ? button['aria-pressed'] === true : rank > 0) || undefined}
    >
      <img src={fearArtwork[vowKey]} alt="" width={48} height={48} />
      <span className="fear-rank-caption">
        <span>{label}</span>
        {maximum === undefined ? null : (
          <span className="fear-rank-segments" aria-hidden="true">
            {Array.from({ length: maximum }, (_, index) => (
              <span key={index} data-filled={index < (rank ?? 0) || undefined} />
            ))}
          </span>
        )}
      </span>
    </button>
  );
}

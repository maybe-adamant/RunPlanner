import type { ButtonHTMLAttributes } from 'react';
import { arcanaArtwork } from './arcanaArtwork';

export function ArcanaCard({
  cardKey,
  label,
  rarity,
  resultRarity,
  selectionOrder,
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly cardKey: string;
  readonly label: string;
  readonly rarity?: string | null | undefined;
  readonly resultRarity?: string | null | undefined;
  readonly selectionOrder?: number | undefined;
}) {
  const selected = button['aria-pressed'] === true;
  const preview = selected && resultRarity != null;
  const displayedRarity = preview ? resultRarity : rarity;
  const ranks: Readonly<Record<string, number>> = { Common: 1, Rare: 2, Epic: 3, Heroic: 4 };
  const rankNumerals: Readonly<Record<string, string>> = {
    Common: 'I',
    Rare: 'II',
    Epic: 'III',
    Heroic: 'IV',
    mixed: '—',
  };
  const rankText =
    displayedRarity == null
      ? undefined
      : displayedRarity === 'mixed'
        ? 'Rank varies'
        : `${displayedRarity} · Rank ${ranks[displayedRarity]}`;
  const rankDescription =
    rankText === undefined ? 'Inactive' : `${preview ? 'Grants' : 'Current'}: ${rankText}`;
  return (
    <button
      {...button}
      type="button"
      className="arcana-card-control"
      aria-label={button['aria-label'] ?? label}
      aria-description={
        button['aria-description'] ??
        `${rankDescription}${selectionOrder === undefined ? '' : `; pick ${selectionOrder}`}`
      }
      title={button.title ?? rankDescription}
      data-rarity={displayedRarity ?? undefined}
      data-active={displayedRarity != null || selected || undefined}
    >
      <span className="arcana-card-image">
        <img
          src={arcanaArtwork[cardKey]}
          alt=""
          className="arcana-card-artwork"
          width={320}
          height={498}
        />
        {rankText === undefined ? null : (
          <span className="arcana-card-rank" aria-hidden="true">
            {rankNumerals[displayedRarity ?? '']}
          </span>
        )}
      </span>
      <span>{label}</span>
      <span className="arcana-card-order" aria-hidden={!selected}>
        {selected ? (selectionOrder === undefined ? '✓' : `Pick ${selectionOrder}`) : '\u00a0'}
      </span>
    </button>
  );
}

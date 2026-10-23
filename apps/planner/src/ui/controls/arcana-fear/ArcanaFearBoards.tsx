import type {
  DerivedRouteLoadout,
  RouteLoadoutEditDomain,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import { ArcanaCard } from './ArcanaCard';
import { FearCard } from './FearCard';
import { fearVowsInGridOrder, maximumFear } from './fearVowOrder';

/** A picker dialog's title with its board's summary, such as "Arcana · 14 active · 30 / 30 Grasp". */
export function ArcanaDialogTitle({
  derived,
  title,
}: {
  readonly derived: DerivedRouteLoadout;
  readonly title: string;
}) {
  return (
    <>
      {title}
      {/* The board's own group name carries the count for assistive technology. */}
      <span aria-hidden="true" className="loadout-dialog-summary">
        {' '}
        · {derived.activeArcanaKeys.length} active · {derived.startingArcanaGrasp.cost} /{' '}
        {derived.startingArcanaGrasp.capacity} Grasp
      </span>
    </>
  );
}

/** Such as "Fear · 3 active · 12 / 67 Fear". */
export function FearDialogTitle({
  catalog,
  derived,
  fearRanks,
  title,
}: {
  readonly catalog: Catalog;
  readonly derived: DerivedRouteLoadout;
  readonly fearRanks: Readonly<Record<string, number>>;
  readonly title: string;
}) {
  const active = fearVowsInGridOrder(catalog).filter((vow) => (fearRanks[vow.key] ?? 0) > 0);
  return (
    <>
      {title}
      <span aria-hidden="true" className="loadout-dialog-summary">
        {' '}
        · {active.length} active · {derived.fearTotal} / {maximumFear(catalog)} Fear
      </span>
    </>
  );
}

/**
 * The Arcana board over the engine's edit domain: each manual card toggles to the selection the
 * domain names; a card that would exceed the starting Grasp stays off.
 */
export function ArcanaBoard({
  catalog,
  derived,
  domain,
  onReplace,
  rarityOf,
}: {
  readonly catalog: Catalog;
  readonly derived: DerivedRouteLoadout;
  readonly domain: RouteLoadoutEditDomain;
  readonly onReplace: (arcanaKeys: readonly string[]) => void;
  readonly rarityOf?: (cardKey: string) => string | undefined;
}) {
  const manualArcana = new Map(domain.manualArcana.map((toggle) => [toggle.key, toggle]));
  return (
    <section
      role="group"
      aria-label={`Arcana, ${derived.activeArcanaKeys.length} active`}
      className="route-loadout-section"
    >
      <div className="arcana-board">
        {catalog.arcanaCards.values.map((card) => {
          const toggle = manualArcana.get(card.key);
          const automatic = toggle === undefined;
          const selected = toggle?.selected ?? derived.automaticArcanaKeys.includes(card.key);
          // Deselecting stays available so an over-capacity selection can be repaired.
          const exceedsGrasp = toggle !== undefined && !toggle.selected && !toggle.grasp.legal;
          return (
            <ArcanaCard
              key={card.key}
              cardKey={card.key}
              rarity={rarityOf?.(card.key)}
              label={`${card.label}${automatic ? ' (automatic)' : ''}`}
              data-automatic={automatic}
              aria-pressed={selected}
              disabled={automatic || exceedsGrasp}
              type="button"
              onClick={() => {
                if (toggle !== undefined) onReplace(toggle.arcanaKeys);
              }}
              hint={
                exceedsGrasp
                  ? `${toggle.grasp.cost} Grasp exceeds the starting capacity of ${toggle.grasp.capacity}.`
                  : undefined
              }
            />
          );
        })}
      </div>
    </section>
  );
}

/** The Vow ranks over the engine's edit domain: click cycles a rank, right-click resets it. */
export function FearBoard({
  catalog,
  derived,
  domain,
  onRank,
}: {
  readonly catalog: Catalog;
  readonly derived: DerivedRouteLoadout;
  readonly domain: RouteLoadoutEditDomain;
  readonly onRank: (vowKey: string, rank: number) => void;
}) {
  const vowRanks = new Map(domain.fearVows.map((vow) => [vow.key, vow]));
  return (
    <section
      role="group"
      aria-label={`Fear, ${derived.fearTotal} total`}
      className="route-loadout-section"
    >
      <p className="panel-description">Click to cycle ranks · Right-click to reset</p>
      <div className="fear-rank-list">
        {fearVowsInGridOrder(catalog).map((vow) => {
          const { rank, maximum, legalRanks } = vowRanks.get(vow.key)!;
          const nextRank = rank >= maximum ? 0 : rank + 1;
          const canAdvance = legalRanks.includes(nextRank);
          const setRank = (value: number) => {
            if (value === rank || !legalRanks.includes(value)) return;
            onRank(vow.key, value);
          };
          return (
            <FearCard
              key={vow.key}
              vowKey={vow.key}
              label={vow.label}
              rank={rank}
              maximum={maximum}
              type="button"
              className="fear-rank-control"
              aria-label={`${vow.label}, rank ${rank} of ${maximum}`}
              aria-disabled={!canAdvance}
              data-active={rank > 0 || undefined}
              hint={
                canAdvance ? undefined : 'Too little Grasp for your Arcana. Remove Arcana first.'
              }
              data-fear-vow-key={vow.key}
              data-rival={vow.key === 'BossDifficultyShrineUpgrade' || undefined}
              onClick={() => setRank(nextRank)}
              onContextMenu={(event) => {
                event.preventDefault();
                setRank(0);
              }}
            />
          );
        })}
      </div>
    </section>
  );
}

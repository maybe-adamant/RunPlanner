import { useCallback, useEffect, useRef } from 'react';

import type {
  WorkspaceRunStateBagSection,
  WorkspaceRunStateLauncher,
} from '@planner/projections/structured-workspace';
import { runStateClosed, runStateOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';

export function RunStateLauncher({ launcher }: { readonly launcher: WorkspaceRunStateLauncher }) {
  const dispatch = useAppDispatch();
  const unavailable = launcher.availability === 'unavailable';
  return (
    <span className="run-state-launcher">
      <button
        className="quiet-action action-compact"
        data-run-state-launcher={JSON.stringify(launcher.owner)}
        disabled={unavailable}
        onClick={() => {
          if (launcher.availability === 'available') dispatch(runStateOpened(launcher.owner));
        }}
        type="button"
      >
        Run State
      </button>
    </span>
  );
}

function BagSection({
  label,
  section,
}: {
  readonly label: string;
  readonly section: WorkspaceRunStateBagSection;
}) {
  return (
    <div className="run-state-bag-section">
      <strong>
        {label} · {section.total}
      </strong>
      {section.entries.length === 0 ? (
        <p>None</p>
      ) : (
        section.entries.map((entry) => (
          <details key={`${entry.technicalKey}-${label}`}>
            <summary>
              {entry.label} ({entry.technicalKey}) {entry.count}
            </summary>
            <ul aria-label={`${entry.label} conditions`}>
              {entry.conditions.map((condition, index) => (
                <li key={`${condition.technicalKey}-${index}`}>
                  {condition.explanation} <code>{condition.technicalKey}</code> {condition.count}
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

function ordinal(value: number): string {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
}

export function RunStateSheet({ launcher }: { readonly launcher: WorkspaceRunStateLauncher }) {
  const dispatch = useAppDispatch();
  const close = useCallback(() => dispatch(runStateClosed()), [dispatch]);
  const closeButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(
    typeof document === 'undefined' || !(document.activeElement instanceof HTMLElement)
      ? null
      : document.activeElement,
  );
  useEffect(() => {
    const opener = restoreFocus.current;
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [close]);
  if (launcher.availability !== 'available') return null;
  const { state } = launcher;
  return (
    <aside aria-label={`State before ${launcher.title}`} className="run-state-sheet" role="region">
      <header>
        <h2>State before {launcher.title}</h2>
        <button
          aria-label="Close Run State"
          className="quiet-action"
          onClick={close}
          ref={closeButton}
          type="button"
        >
          ×
        </button>
      </header>
      <details className="run-state-summary-section">
        <summary>
          Keepsakes <span>{state.keepsakes.currentLabel}</span>
        </summary>
        <ol className="run-state-keepsake-chronology">
          {state.keepsakes.chronology.map((entry) => (
            <li key={entry.biomeNumber}>
              <span>{ordinal(entry.biomeNumber)} Biome:</span> {entry.label}
              {entry.retained ? ' (retained)' : ''}
            </li>
          ))}
        </ol>
        <p>Fated: {state.keepsakes.fatedStatus}</p>
        {state.keepsakes.jeweledPomStatus === 'inactive' ? null : (
          <p>Jeweled Pom: {state.keepsakes.jeweledPomStatus}</p>
        )}
        {state.keepsakes.callingCardRemainingCharges === undefined ? null : (
          <p>Calling Card: {state.keepsakes.callingCardRemainingCharges} charges remaining</p>
        )}
        {state.keepsakes.pendingRewardPriorities.length === 0 ? null : (
          <p>Reward priorities: {state.keepsakes.pendingRewardPriorities.join(', ')}</p>
        )}
        {state.keepsakes.olympianSources.map((source) => (
          <p key={`${source.origin}-${source.providerKey}`}>
            {source.providerLabel} ({source.origin}): force {source.forceRemaining}, rarification{' '}
            {source.rarificationRemaining}, source cap {source.maximumSourceRarityLevel}
          </p>
        ))}
        {state.keepsakes.timePieceRemainingCharges === undefined ? null : (
          <p>Time Piece: {state.keepsakes.timePieceRemainingCharges} charges remaining</p>
        )}
        {state.keepsakes.echoGift === undefined ? null : (
          <p>
            Gift Gift Gift: {state.keepsakes.echoGift.capturedKeepsakeLabel} ·{' '}
            {state.keepsakes.echoGift.status} · {state.keepsakes.echoGift.replayCount} replays
          </p>
        )}
        {state.keepsakes.experimentalHammers.length === 0 ? null : (
          <div>
            Experimental Hammers:
            <ul>
              {state.keepsakes.experimentalHammers.map((hammer) => (
                <li key={hammer.acquisitionIdentity}>
                  {hammer.traitLabel} · {hammer.status} ({hammer.remainingUses} encounters
                  remaining)
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.keepsakes.transcendentEmbryo === undefined ? null : (
          <p>
            Transcendent Embryo: {state.keepsakes.transcendentEmbryo.markedBlessingLabel} ·{' '}
            {state.keepsakes.transcendentEmbryo.rarity} ·{' '}
            {state.keepsakes.transcendentEmbryo.progress}/
            {state.keepsakes.transcendentEmbryo.interval} encounter checkpoints ·{' '}
            {state.keepsakes.transcendentEmbryo.origin}
          </p>
        )}
        {state.keepsakes.figLeafRemainingUses === undefined ? null : (
          <p>
            Fig Leaf: {state.keepsakes.figLeafRemainingUses} uses remaining
            {state.keepsakes.figLeafActivatedThisBiome ? ' · already used this biome' : ''}
          </p>
        )}
        {state.keepsakes.gorgonStatus === undefined ? null : (
          <p>
            Gorgon Amulet: {state.keepsakes.gorgonStatus}
            {state.keepsakes.gorgonRarity === undefined ? '' : ` (${state.keepsakes.gorgonRarity})`}
          </p>
        )}
        {state.keepsakes.phialStatus === undefined ? null : (
          <p>Aromatic Phial: {state.keepsakes.phialStatus}</p>
        )}
        {state.keepsakes.stoneStatus === undefined ? null : (
          <p>
            Concave Stone: {state.keepsakes.stoneStatus} · {state.keepsakes.stoneOrigin} ·{' '}
            {state.keepsakes.stoneRank}
          </p>
        )}
      </details>
      <details className="run-state-summary-section">
        <summary>Hex progress</summary>
        {state.hexProgress.baseSpellLabel === undefined ? null : (
          <p>Spell: {state.hexProgress.baseSpellLabel}</p>
        )}
        {state.hexProgress.layoutLabel === undefined ? null : (
          <p>
            Layout: {state.hexProgress.layoutLabel} · capacity {state.hexProgress.baseCapacity}/
            {state.hexProgress.effectiveCapacity}
          </p>
        )}
        <p>God Sent: {state.hexProgress.godSentAdded ? 'present' : 'absent'}</p>
        <p>Talent Drops: {state.hexProgress.talentDropsClosed ? 'closed' : 'open'}</p>
        <p>Banked Path points: {state.hexProgress.bankedPathPoints}</p>
        <p>
          Aggregate invested Path points: {state.hexProgress.investedPathPoints} (sim-neutral nodes)
        </p>
      </details>
      <details className="run-state-summary-section">
        <summary>
          Arcana <span>{state.arcana.length} active</span>
        </summary>
        {state.artificer === undefined ? null : (
          <p>
            The Artificer: {state.artificer.spent}/{state.artificer.capacity} spent ·{' '}
            {state.artificer.remaining} remaining
          </p>
        )}
        {state.arcana.length === 0 ? (
          <p>None active</p>
        ) : (
          <ul>
            {state.arcana.map((card) => (
              <li key={card.key}>{card.label}</li>
            ))}
          </ul>
        )}
      </details>
      <details className="run-state-summary-section">
        <summary>
          Fear <span>{state.fear.configuredTotal} configured</span>
        </summary>
        {state.fear.active.length === 0 ? (
          <p>None active</p>
        ) : (
          <ul className="run-state-fear-list" aria-label="Active Fear vows">
            {state.fear.active.map((vow) => (
              <li key={vow.key}>
                {vow.label} <span>Rank {vow.rank}</span>
              </li>
            ))}
          </ul>
        )}
        <p>Vow of Forfeit: {state.fear.forfeitStatus}</p>
        {state.fear.disabled.length === 0 ? null : (
          <div>
            Circe-disabled:
            <ul className="run-state-fear-list" aria-label="Circe-disabled Fear vows">
              {state.fear.disabled.map((vow) => (
                <li key={vow.key}>
                  {vow.label} <span>Rank {vow.rank}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
      <section>
        <h3>Gods in pool</h3>
        <p>{state.godPool.inPool.map(({ label }) => label).join(' · ') || 'None yet'}</p>
      </section>
      <section>
        <h3>Elements</h3>
        <p>{state.elements.map(({ key, value }) => `${key} ${value}`).join(' · ')}</p>
      </section>
      <section>
        <h3>Equipped traits</h3>
        <dl className="run-state-core-traits">
          {state.traits.coreSlots.map((slot) => (
            <div key={slot.slotKey}>
              <dt>{slot.label}:</dt>
              <dd>
                {slot.trait === undefined
                  ? 'None'
                  : `${slot.trait.label}${slot.trait.rarity === undefined ? '' : ` · ${slot.trait.rarity}`}${slot.trait.level === undefined ? '' : ` · Lv. ${slot.trait.level}`}${slot.trait.hammerRank === undefined ? '' : ` · ${slot.trait.hammerRank === 'RankII' ? 'Rank II' : 'Rank I'}`}${slot.trait.steadyGrowthInterval === undefined ? '' : ` · Steady Growth ${slot.trait.steadyGrowthProgress ?? 0}/${slot.trait.steadyGrowthInterval}`}`}
              </dd>
            </div>
          ))}
        </dl>
        <h4>All other traits</h4>
        {state.traits.other.length === 0 ? (
          <p>None</p>
        ) : (
          <ul>
            {state.traits.other.map((trait) => (
              <li key={trait.traitKey}>
                {trait.label}
                {trait.rarity === undefined ? '' : ` · ${trait.rarity}`}
                {trait.level === undefined ? '' : ` · Lv. ${trait.level}`}
                {trait.hammerRank === undefined
                  ? ''
                  : ` · ${trait.hammerRank === 'RankII' ? 'Rank II' : 'Rank I'}`}
                {trait.steadyGrowthInterval === undefined
                  ? ''
                  : ` · Steady Growth ${trait.steadyGrowthProgress ?? 0}/${trait.steadyGrowthInterval}`}
              </li>
            ))}
          </ul>
        )}
        {state.traits.properUpbringingActive === undefined ? null : <p>Proper Upbringing active</p>}
        {state.traits.echoShopDuplicateStatus === undefined ? null : (
          <p>
            Gold Gold Gold:{' '}
            {state.traits.echoShopDuplicateStatus === 'pending' ? 'Pending' : 'Consumed'}
          </p>
        )}
        <h4>Banned traits</h4>
        <p>{state.traits.banned.map(({ label }) => label).join(' · ') || 'None'}</p>
      </section>
      <section>
        <h3>More Info</h3>
        <details>
          <summary>Counters</summary>
          <dl className="run-state-counter-list">
            {state.counters.map(({ key, value }) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
        <details>
          <summary>Reward Bags</summary>
          {state.bags.map((bag) => (
            <details key={bag.technicalKey}>
              <summary>
                {bag.label} ({bag.technicalKey}) · {bag.remaining} · Eligible now{' '}
                {bag.eligible.total} · Ineligible now {bag.ineligible.total}
              </summary>
              <BagSection label="Eligible now" section={bag.eligible} />
              <BagSection label="Ineligible now" section={bag.ineligible} />
            </details>
          ))}
        </details>
      </section>
    </aside>
  );
}

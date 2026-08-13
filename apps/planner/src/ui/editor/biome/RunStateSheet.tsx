import { useCallback, useEffect, useRef } from 'react';

import type {
  WorkspaceRunStateBagSection,
  WorkspaceRunStateLauncher,
} from '@planner/projections/structured-workspace';
import { runStateClosed, runStateOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';

export function RunStateLauncher({ launcher }: { readonly launcher: WorkspaceRunStateLauncher }) {
  const dispatch = useAppDispatch();
  const descriptionId = `run-state-unavailable-${launcher.owner.biomeKey}-${launcher.title.replaceAll(' ', '-')}`;
  const unavailable = launcher.availability === 'unavailable';
  return (
    <span className="run-state-launcher">
      <button
        aria-describedby={unavailable ? descriptionId : undefined}
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
      {unavailable ? (
        <span className="run-state-unavailable" id={descriptionId} role="status">
          {launcher.reason}
        </span>
      ) : null}
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
        <button aria-label="Close Run State" onClick={close} ref={closeButton} type="button">
          ×
        </button>
      </header>
      <section>
        <h3>Keepsakes</h3>
        <p>Current: {state.keepsakes.currentLabel}</p>
        <p>Fated: {state.keepsakes.fatedStatus}</p>
        <p>Jeweled Pom: {state.keepsakes.jeweledPomStatus}</p>
        <p>
          Calling Card:{' '}
          {state.keepsakes.callingCardRemainingCharges === undefined
            ? 'inactive'
            : `${state.keepsakes.callingCardRemainingCharges} charges remaining`}
        </p>
        <p>
          Time Piece:{' '}
          {state.keepsakes.timePieceRemainingCharges === undefined
            ? 'inactive'
            : `${state.keepsakes.timePieceRemainingCharges} charges remaining`}
        </p>
        <p>
          Experimental Hammer: {state.keepsakes.experimentalHammerStatus}
          {state.keepsakes.experimentalHammerTraitLabel === undefined
            ? ''
            : ` · ${state.keepsakes.experimentalHammerTraitLabel}`}
          {state.keepsakes.experimentalHammerRemainingUses === undefined
            ? ''
            : ` (${state.keepsakes.experimentalHammerRemainingUses} encounters remaining)`}
        </p>
        <p>
          Fig Leaf:{' '}
          {state.keepsakes.figLeafRemainingUses === undefined
            ? 'inactive'
            : `${state.keepsakes.figLeafRemainingUses} uses remaining${
                state.keepsakes.figLeafActivatedThisBiome ? ' · already used this biome' : ''
              }`}
        </p>
        <p>Removed: {state.keepsakes.removedLabels.join(' · ') || 'None'}</p>
      </section>
      <section>
        <h3>Arcana</h3>
        {state.arcana.length === 0 ? (
          <p>None active</p>
        ) : (
          <ul>
            {state.arcana.map((card) => (
              <li key={card.key}>
                {card.label} · {card.rarity} · {card.origin}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3>Fear · {state.fear.configuredTotal} configured</h3>
        <p>
          Active:{' '}
          {state.fear.active.map((vow) => `${vow.label} · Rank ${vow.rank}`).join(' · ') || 'None'}
        </p>
        <p>Vow of Forfeit: {state.fear.forfeitStatus}</p>
        {state.fear.disabled.length === 0 ? null : (
          <p>
            Circe-disabled:{' '}
            {state.fear.disabled.map((vow) => `${vow.label} · Rank ${vow.rank}`).join(' · ')}
          </p>
        )}
      </section>
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
                  : `${slot.trait.label}${slot.trait.rarity === undefined ? '' : ` · ${slot.trait.rarity}`}${slot.trait.level === undefined ? '' : ` · Lv. ${slot.trait.level}`}${slot.trait.hammerRank === undefined ? '' : ` · ${slot.trait.hammerRank === 'RankII' ? 'Rank II' : 'Rank I'}`}`}
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
              </li>
            ))}
          </ul>
        )}
        {state.traits.activeMinimumScalableRarity === undefined ? null : (
          <p>Active minimum scalable rarity: {state.traits.activeMinimumScalableRarity}</p>
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

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
    <aside
      aria-label={`Run state — before ${launcher.title}`}
      className="run-state-sheet"
      role="region"
    >
      <header>
        <h2>Run state — before {launcher.title}</h2>
        <button aria-label="Close Run State" onClick={close} ref={closeButton} type="button">
          ×
        </button>
      </header>
      <section>
        <h3>God pool</h3>
        <p>
          Acquired:{' '}
          {state.godPool.acquired.map(({ label, key }) => `${label} (${key})`).join(', ') || 'None'}
        </p>
        <p>
          Effective:{' '}
          {state.godPool.effective.map(({ label, key }) => `${label} (${key})`).join(', ') ||
            'None'}
        </p>
        <p>Four-source cap: {state.godPool.capNarrowed ? 'narrowed' : 'not narrowed'}</p>
      </section>
      <section>
        <h3>Elements</h3>
        <p>{state.elements.map(({ key, value }) => `${key} ${value}`).join(' · ')}</p>
      </section>
      <section>
        <h3>Equipped traits</h3>
        {state.traits.equipped.length === 0 ? (
          <p>None</p>
        ) : (
          <ul>
            {state.traits.equipped.map((trait) => (
              <li key={trait.traitKey}>
                {trait.label} ({trait.traitKey}) · {trait.giverLabel} ({trait.giverKey})
                {trait.rarity === undefined ? '' : ` · ${trait.rarity}`}
                {trait.ordinarySlot === undefined ? '' : ` · ${trait.ordinarySlot}`}
              </li>
            ))}
          </ul>
        )}
        <p>Upgradable traits: {state.traits.upgradableCount}</p>
        {state.traits.activeMinimumScalableRarity === undefined ? null : (
          <p>Active minimum scalable rarity: {state.traits.activeMinimumScalableRarity}</p>
        )}
      </section>
      <section>
        <h3>Counters</h3>
        <p>{state.counters.map(({ key, value }) => `${key} ${value}`).join(' · ')}</p>
      </section>
      <section>
        <h3>Counted reward bags</h3>
        {state.bags.map((bag) => (
          <details key={bag.technicalKey}>
            <summary>
              {bag.label} ({bag.technicalKey}) · {bag.remaining} · Eligible now {bag.eligible.total}{' '}
              · Ineligible now {bag.ineligible.total}
            </summary>
            <BagSection label="Eligible now" section={bag.eligible} />
            <BagSection label="Ineligible now" section={bag.ineligible} />
          </details>
        ))}
      </section>
    </aside>
  );
}

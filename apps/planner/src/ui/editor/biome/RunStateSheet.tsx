import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

import type {
  WorkspaceRunStateBagSection,
  WorkspaceRunStateLauncher,
  WorkspaceRunStateTrait,
} from '@planner/projections/structured-workspace';
import { runStateClosed, runStateOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';

const runStateTabs = ['Overview', 'Arcana', 'Fear', 'Hex', 'More Info'] as const;
type RunStateTab = (typeof runStateTabs)[number];

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
      <h5>{label}</h5>
      {section.entries.length === 0 ? (
        <p className="run-state-muted">None</p>
      ) : (
        section.entries.map((entry) => (
          <details key={`${entry.technicalKey}-${label}`}>
            <summary>
              {entry.label} <span className="run-state-count">{entry.count}</span>
            </summary>
            <code className="run-state-technical-key">{entry.technicalKey}</code>
            <ul aria-label={`${entry.label} conditions`}>
              {entry.conditions.map((condition, index) => (
                <li key={`${condition.technicalKey}-${index}`}>
                  {condition.explanation} <span className="run-state-count">{condition.count}</span>
                  <code className="run-state-technical-key">{condition.technicalKey}</code>
                </li>
              ))}
            </ul>
          </details>
        ))
      )}
    </div>
  );
}

function StateRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function TraitSummary({ trait }: { readonly trait: WorkspaceRunStateTrait }) {
  return (
    <div className="run-state-trait">
      <span className="run-state-trait-name">{trait.label}</span>
      <span className="run-state-metadata">
        {trait.rarity === undefined ? null : <span>{trait.rarity}</span>}
        {trait.level === undefined ? null : <span>Lv. {trait.level}</span>}
        {trait.hammerRank === undefined ? null : (
          <span>{trait.hammerRank === 'RankII' ? 'Rank II' : 'Rank I'}</span>
        )}
        {trait.steadyGrowthInterval === undefined ? null : (
          <span>
            Steady Growth {trait.steadyGrowthProgress ?? 0}/{trait.steadyGrowthInterval}
          </span>
        )}
      </span>
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
  const [activeTab, setActiveTab] = useState<RunStateTab>('Overview');
  const sheetId = useId();
  const tabId = (tab: RunStateTab) => `${sheetId}-tab-${runStateTabs.indexOf(tab)}`;
  const panelId = `${sheetId}-panel`;
  const tabRefs = useRef<Partial<Record<RunStateTab, HTMLButtonElement | null>>>({});
  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, tab: RunStateTab) => {
    const currentIndex = runStateTabs.indexOf(tab);
    let nextIndex: number;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % runStateTabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + runStateTabs.length) % runStateTabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = runStateTabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = runStateTabs[nextIndex];
    if (nextTab === undefined) return;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
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
        <div className="run-state-heading">
          <h2>Run State</h2>
          <button
            aria-label="Close Run State"
            className="quiet-action"
            onClick={close}
            ref={closeButton}
            type="button"
          >
            ×
          </button>
        </div>
        <nav aria-label="Run State sections" className="run-state-tabs" role="tablist">
          {runStateTabs.map((tab) => (
            <button
              aria-controls={panelId}
              aria-selected={activeTab === tab}
              className="run-state-tab"
              id={tabId(tab)}
              key={tab}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(event) => onTabKeyDown(event, tab)}
              ref={(element) => {
                tabRefs.current[tab] = element;
              }}
              role="tab"
              tabIndex={activeTab === tab ? 0 : -1}
              type="button"
            >
              {tab}
            </button>
          ))}
        </nav>
      </header>
      <div aria-labelledby={tabId(activeTab)} id={panelId} role="tabpanel" tabIndex={0}>
        {activeTab === 'Overview' ? (
          <section className="run-state-section">
            <h3>Keepsake</h3>
            <p className="run-state-current-keepsake">{state.keepsakes.currentLabel}</p>
            <dl className="run-state-values">
              {state.keepsakes.chronology.map((entry) => (
                <StateRow key={entry.biomeNumber} label={`${ordinal(entry.biomeNumber)} Biome`}>
                  {entry.label}
                </StateRow>
              ))}
              <StateRow label="Fated">{state.keepsakes.fatedStatus}</StateRow>
              {state.keepsakes.jeweledPomStatus === 'inactive' ? null : (
                <StateRow label="Jeweled Pom">{state.keepsakes.jeweledPomStatus}</StateRow>
              )}
              {state.keepsakes.callingCardRemainingCharges === undefined ? null : (
                <StateRow label="Calling Card">
                  {state.keepsakes.callingCardRemainingCharges} charges remaining
                </StateRow>
              )}
              {state.keepsakes.pendingRewardPriorities.length === 0 ? null : (
                <StateRow label="Reward priorities">
                  {state.keepsakes.pendingRewardPriorities.join(', ')}
                </StateRow>
              )}
              {state.keepsakes.olympianSources.map((source) => (
                <StateRow
                  key={`${source.origin}-${source.providerKey}`}
                  label={source.providerLabel}
                >
                  <span>
                    Force {source.forceRemaining} · Rarification {source.rarificationRemaining}
                  </span>
                  <span className="run-state-metadata">
                    Source cap {source.maximumSourceRarityLevel} · {source.origin}
                  </span>
                </StateRow>
              ))}
              {state.keepsakes.timePieceRemainingCharges === undefined ? null : (
                <StateRow label="Time Piece">
                  {state.keepsakes.timePieceRemainingCharges} charges remaining
                </StateRow>
              )}
              {state.keepsakes.echoGift === undefined ? null : (
                <StateRow label="Gift Gift Gift">
                  {state.keepsakes.echoGift.capturedKeepsakeLabel}
                  <span className="run-state-metadata">
                    {state.keepsakes.echoGift.status} · {state.keepsakes.echoGift.replayCount}{' '}
                    replays
                  </span>
                </StateRow>
              )}
              {state.keepsakes.experimentalHammers.length === 0 ? null : (
                <StateRow label="Experimental Hammers">
                  <ul className="run-state-plain-list">
                    {state.keepsakes.experimentalHammers.map((hammer) => (
                      <li key={hammer.acquisitionIdentity}>
                        {hammer.traitLabel}
                        <span className="run-state-metadata">
                          {hammer.status} · {hammer.remainingUses} encounters remaining
                        </span>
                      </li>
                    ))}
                  </ul>
                </StateRow>
              )}
              {state.keepsakes.transcendentEmbryo === undefined ? null : (
                <StateRow label="Transcendent Embryo">
                  {state.keepsakes.transcendentEmbryo.markedBlessingLabel}
                  <span className="run-state-metadata">
                    {state.keepsakes.transcendentEmbryo.rarity} ·{' '}
                    {state.keepsakes.transcendentEmbryo.progress}/
                    {state.keepsakes.transcendentEmbryo.interval} encounter checkpoints ·{' '}
                    {state.keepsakes.transcendentEmbryo.origin}
                  </span>
                </StateRow>
              )}
              {state.keepsakes.figLeafRemainingUses === undefined ? null : (
                <StateRow label="Fig Leaf">
                  {state.keepsakes.figLeafRemainingUses} uses remaining
                  {state.keepsakes.figLeafActivatedThisBiome ? (
                    <span className="run-state-metadata">Already used this biome</span>
                  ) : null}
                </StateRow>
              )}
              {state.keepsakes.gorgonStatus === undefined ? null : (
                <StateRow label="Gorgon Amulet">
                  {state.keepsakes.gorgonStatus}
                  {state.keepsakes.gorgonRarityLevel === undefined ? null : (
                    <span className="run-state-metadata">
                      Source level {state.keepsakes.gorgonRarityLevel}
                    </span>
                  )}
                </StateRow>
              )}
              {state.keepsakes.phialStatus === undefined ? null : (
                <StateRow label="Aromatic Phial">{state.keepsakes.phialStatus}</StateRow>
              )}
              {state.keepsakes.stoneStatus === undefined ? null : (
                <StateRow label="Concave Stone">
                  {state.keepsakes.stoneStatus}
                  <span className="run-state-metadata">
                    {state.keepsakes.stoneOrigin} · {state.keepsakes.stoneRank}
                  </span>
                </StateRow>
              )}
            </dl>
          </section>
        ) : null}
        {activeTab === 'Hex' ? (
          <>
            <section className="run-state-section">
              <h3>Hex</h3>
              <dl className="run-state-values">
                <StateRow label="Hex">{state.hexProgress.baseSpellLabel ?? 'None'}</StateRow>
                {state.hexProgress.layoutLabel === undefined ? null : (
                  <>
                    <StateRow label="Layout">{state.hexProgress.layoutLabel}</StateRow>
                    <StateRow label="Base capacity">{state.hexProgress.baseCapacity}</StateRow>
                    <StateRow label="Effective capacity">
                      {state.hexProgress.effectiveCapacity}
                    </StateRow>
                  </>
                )}
                <StateRow label="God Sent">{state.hexProgress.godSentLabel}</StateRow>
                <StateRow label="Path of Stars">{state.hexProgress.pathOfStarsLabel}</StateRow>
              </dl>
            </section>
            <section className="run-state-section">
              <h3>Path points</h3>
              <dl className="run-state-values">
                <StateRow label="Banked">{state.hexProgress.bankedPathPoints}</StateRow>
                <StateRow label="Invested">
                  {state.hexProgress.investedPathPoints}
                  <span className="run-state-metadata">Sim-neutral nodes</span>
                </StateRow>
              </dl>
            </section>
          </>
        ) : null}
        {activeTab === 'Arcana' ? (
          <>
            <section className="run-state-section">
              <h3>Arcana</h3>
              <p className="run-state-muted">
                {state.arcana.length === 0 ? 'None active' : `${state.arcana.length} active`}
              </p>
              {state.arcana.length === 0 ? null : (
                <ul className="run-state-plain-list" aria-label="Active Arcana">
                  {state.arcana.map((card) => (
                    <li key={card.key}>{card.label}</li>
                  ))}
                </ul>
              )}
            </section>
            {state.artificer === undefined ? null : (
              <section className="run-state-section">
                <h3>The Artificer</h3>
                <dl className="run-state-values">
                  <StateRow label="Spent">
                    {state.artificer.spent}/{state.artificer.capacity}
                  </StateRow>
                  <StateRow label="Remaining">{state.artificer.remaining}</StateRow>
                </dl>
              </section>
            )}
          </>
        ) : null}
        {activeTab === 'Fear' ? (
          <>
            <section className="run-state-section">
              <h3>Fear</h3>
              <dl className="run-state-values">
                <StateRow label="Configured">{state.fear.configuredTotal}</StateRow>
                <StateRow label="Vow of Forfeit">{state.fear.forfeitStatus}</StateRow>
              </dl>
              <h4>Active vows</h4>
              {state.fear.active.length === 0 ? (
                <p className="run-state-muted">None active</p>
              ) : (
                <ul className="run-state-fear-list" aria-label="Active Fear vows">
                  {state.fear.active.map((vow) => (
                    <li key={vow.key}>
                      <span>{vow.label}</span>{' '}
                      <span className="run-state-metadata">Rank {vow.rank}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {state.fear.disabled.length === 0 ? null : (
              <section className="run-state-section">
                <h3>Circe-disabled</h3>
                <ul className="run-state-fear-list" aria-label="Circe-disabled Fear vows">
                  {state.fear.disabled.map((vow) => (
                    <li key={vow.key}>
                      <span>{vow.label}</span>{' '}
                      <span className="run-state-metadata">Rank {vow.rank}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="run-state-section">
              <h3>Banned traits</h3>
              {state.traits.banned.length === 0 ? (
                <p className="run-state-muted">None</p>
              ) : (
                <ul className="run-state-plain-list">
                  {state.traits.banned.map(({ key, label }) => (
                    <li key={key}>{label}</li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
        {activeTab === 'Overview' ? (
          <>
            <section className="run-state-section">
              <h3>Gods in pool</h3>
              {state.godPool.inPool.length === 0 ? (
                <p className="run-state-muted">None yet</p>
              ) : (
                <ul className="run-state-inline-list">
                  {state.godPool.inPool.map(({ key, label }) => (
                    <li key={key}>{label}</li>
                  ))}
                </ul>
              )}
            </section>
            <section className="run-state-section">
              <h3>Elements</h3>
              <dl className="run-state-elements">
                {state.elements.map(({ key, value }) => (
                  <StateRow key={key} label={key}>
                    {value}
                  </StateRow>
                ))}
              </dl>
            </section>
            <section className="run-state-section">
              <h3>Equipped traits</h3>
              <dl className="run-state-core-traits">
                {state.traits.coreSlots.map((slot) => (
                  <div key={slot.slotKey}>
                    <dt>{slot.label}:</dt>
                    <dd>
                      {slot.trait === undefined ? (
                        <span className="run-state-muted">None</span>
                      ) : (
                        <TraitSummary trait={slot.trait} />
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              <h4>All other traits</h4>
              {state.traits.other.length === 0 ? (
                <p className="run-state-muted">None</p>
              ) : (
                <ul className="run-state-plain-list">
                  {state.traits.other.map((trait) => (
                    <li key={trait.traitKey}>
                      <TraitSummary trait={trait} />
                    </li>
                  ))}
                </ul>
              )}
              {state.traits.properUpbringingActive === undefined ? null : (
                <p>Proper Upbringing active</p>
              )}
              {state.traits.echoShopDuplicateStatus === undefined ? null : (
                <p>
                  Gold Gold Gold:{' '}
                  {state.traits.echoShopDuplicateStatus === 'pending' ? 'Pending' : 'Consumed'}
                </p>
              )}
            </section>
          </>
        ) : null}
        {activeTab === 'More Info' ? (
          <>
            <section className="run-state-section">
              <h3>Counters</h3>
              <dl className="run-state-counter-list">
                {state.counters.map(({ key, value }) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="run-state-section">
              <h3>Reward Store Ratio</h3>
              <p className="run-state-muted">
                Every counted room entered so far this run. A door rolls Minor Reward with chance 11
                × target − 10 × ratio.
              </p>
              <dl className="run-state-values">
                <StateRow label="Entered stores">
                  {state.rewardStoreController.enteredLabel}
                </StateRow>
                <StateRow label="Current ratio">{state.rewardStoreController.ratioLabel}</StateRow>
                <StateRow label="Biome target">{state.rewardStoreController.targetLabel}</StateRow>
              </dl>
            </section>
            <section className="run-state-section">
              <h3>Reward Bags</h3>
              {state.bags.map((bag) => (
                <article className="run-state-bag" key={bag.technicalKey}>
                  <h4>{bag.label}</h4>
                  <code className="run-state-technical-key">{bag.technicalKey}</code>
                  <dl className="run-state-bag-counts">
                    <StateRow label="Remaining">{bag.remaining}</StateRow>
                    <StateRow label="Eligible">{bag.eligible.total}</StateRow>
                    <StateRow label="Ineligible">{bag.ineligible.total}</StateRow>
                  </dl>
                  <BagSection label="Eligible" section={bag.eligible} />
                  <BagSection label="Ineligible" section={bag.ineligible} />
                </article>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </aside>
  );
}

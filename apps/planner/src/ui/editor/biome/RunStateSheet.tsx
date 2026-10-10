import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import type {
  WorkspaceRunStateBagSection,
  WorkspaceRunStateLauncher,
  WorkspaceRunStateRow,
  WorkspaceRunStateSection,
} from '@planner/projections/structured-workspace';
import { runStateClosed, runStateOpened } from '@planner/state/editorSessionSlice';
import { useAppDispatch } from '@planner/state/store';

const runStateTabs = ['Overview', 'Effects', 'Keepsakes', 'Arcana', 'Fear', 'More Info'] as const;
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

function RunStateRows({
  label,
  rows,
}: {
  readonly label?: string;
  readonly rows: readonly WorkspaceRunStateRow[];
}) {
  return (
    <ul aria-label={label} className="run-state-rows">
      {rows.map((row) => (
        <li className="run-state-row" key={row.key}>
          <span className="run-state-row-name">
            {row.name}
            {row.bracket === undefined ? null : (
              <>
                {' '}
                <span className="run-state-row-bracket">{row.bracket}</span>
              </>
            )}
            {row.tag === undefined ? null : (
              <>
                {' '}
                <span className="run-state-row-tag">{row.tag}</span>
              </>
            )}
          </span>
          <span className="run-state-row-right">{row.right}</span>
        </li>
      ))}
    </ul>
  );
}

function RunStateSectionView({ section }: { readonly section: WorkspaceRunStateSection }) {
  return (
    <section className="run-state-section">
      {section.heading === undefined ? null : <h3>{section.heading}</h3>}
      {section.note === undefined ? null : <p className="run-state-muted">{section.note}</p>}
      <RunStateRows
        {...(section.heading === undefined ? {} : { label: section.heading })}
        rows={section.rows}
      />
    </section>
  );
}

function RunStateSections({
  sections,
}: {
  readonly sections: readonly WorkspaceRunStateSection[];
}) {
  return sections.map((section) => <RunStateSectionView key={section.key} section={section} />);
}

function TabSections({ sections }: { readonly sections: readonly WorkspaceRunStateSection[] }) {
  return sections.length === 0 ? (
    <p className="run-state-muted run-state-empty">Nothing active</p>
  ) : (
    <RunStateSections sections={sections} />
  );
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
          <h2>{state.moment}</h2>
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
          <>
            {state.loadout.length === 0 ? null : (
              <section className="run-state-section">
                <RunStateRows label="Loadout" rows={state.loadout} />
              </section>
            )}
            <section className="run-state-section">
              <RunStateRows label="Maxima" rows={state.maxStats.rows} />
              <details className="run-state-max-stat-sources">
                <summary>Sources</summary>
                <RunStateRows label="Maxima sources" rows={state.maxStats.sources} />
              </details>
            </section>
            <RunStateSections sections={state.overview} />
          </>
        ) : null}
        {activeTab === 'Effects' ? <TabSections sections={state.effects} /> : null}
        {activeTab === 'Keepsakes' ? <TabSections sections={state.keepsakes} /> : null}
        {activeTab === 'Arcana' ? <TabSections sections={state.arcana} /> : null}
        {activeTab === 'Fear' ? <TabSections sections={state.fear} /> : null}
        {activeTab === 'More Info' ? (
          <>
            <RunStateSections sections={state.moreInfo.sections} />
            <section className="run-state-section">
              <h3>Reward Bags</h3>
              {state.moreInfo.bags.map((bag) => (
                <article className="run-state-bag" key={bag.technicalKey}>
                  <h4>{bag.label}</h4>
                  <code className="run-state-technical-key">{bag.technicalKey}</code>
                  <RunStateRows rows={bag.rows} />
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

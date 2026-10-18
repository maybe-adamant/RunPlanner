import { useRef, useState, type KeyboardEvent } from 'react';

import type {
  DraftBasketProjection,
  DraftBasketRow,
  DraftBasketSection,
  DraftBasketTab,
} from '@planner/projections/draftSpec';
import { EditorDialog } from '@planner/ui/controls/EditorDialog';
import { hintProps } from '@planner/ui/controls/hint';
import { DraftCapCount } from './DraftCapCount';

function BasketRows({
  onToggle,
  rows,
}: {
  readonly onToggle: (traitKey: string) => void;
  readonly rows: readonly DraftBasketRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="draft-toggle-row">
      {rows.map((row) => {
        const unavailable = !row.inBasket && !row.selectable;
        return (
          <button
            aria-disabled={unavailable || undefined}
            aria-pressed={row.inBasket}
            className="draft-toggle"
            data-refused={(row.inBasket && !row.selectable) || undefined}
            key={row.traitKey}
            onClick={() => {
              if (!unavailable) onToggle(row.traitKey);
            }}
            type="button"
            {...hintProps(row.selectable ? undefined : row.hint)}
          >
            {row.label}
          </button>
        );
      })}
    </div>
  );
}

function BasketSection({
  level,
  onToggle,
  section,
}: {
  readonly level: 3 | 4;
  readonly onToggle: (traitKey: string) => void;
  readonly section: DraftBasketSection;
}) {
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <section aria-label={section.label} className="draft-basket-section" data-level={level}>
      <Heading className="draft-section-heading">
        {section.label}
        <DraftCapCount cap={section.cap} />
      </Heading>
      <BasketRows onToggle={onToggle} rows={section.rows} />
      {section.subsections.map((subsection) => (
        <BasketSection key={subsection.key} level={4} onToggle={onToggle} section={subsection} />
      ))}
    </section>
  );
}

const tabId = (tab: DraftBasketTab['key']) => `draft-basket-tab-${tab}`;

/** Basket traits in Gods, Bonus and NPC tabs; a refused trait stays listed but cannot be added. */
export function DraftBasketDialog({
  onClose,
  onToggle,
  projection,
  returnFocusId,
}: {
  readonly onClose: () => void;
  readonly onToggle: (traitKey: string) => void;
  readonly projection: DraftBasketProjection;
  readonly returnFocusId: string;
}) {
  const [active, setActive] = useState<DraftBasketTab['key']>('gods');
  const tabRefs = useRef<Partial<Record<DraftBasketTab['key'], HTMLButtonElement | null>>>({});
  const tabs = projection.tabs;
  const activeTab = tabs.find((tab) => tab.key === active) ?? tabs[0]!;
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length]!;
    setActive(next.key);
    tabRefs.current[next.key]?.focus();
  };
  return (
    <EditorDialog
      eyebrow="Draft"
      headerAction={
        <div aria-label="Basket givers" className="run-state-tabs draft-basket-tabs" role="tablist">
          {tabs.map((tab, index) => (
            <button
              aria-controls="draft-basket-panel"
              aria-selected={tab.key === activeTab.key}
              className="draft-basket-tab"
              id={tabId(tab.key)}
              key={tab.key}
              onClick={() => setActive(tab.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[tab.key] = element;
              }}
              role="tab"
              tabIndex={tab.key === activeTab.key ? 0 : -1}
              type="button"
            >
              {tab.label}
              <DraftCapCount cap={tab.cap} />
            </button>
          ))}
        </div>
      }
      model={{ kind: 'live', onDone: onClose }}
      returnFocusId={returnFocusId}
      size="cards"
      title="Basket"
    >
      <div
        aria-labelledby={tabId(activeTab.key)}
        className="draft-basket"
        data-tab={activeTab.key}
        id="draft-basket-panel"
        role="tabpanel"
      >
        {activeTab.sections.length === 0 ? (
          <p className="draft-basket-empty">
            {activeTab.key === 'npcs' ? 'No trait-giving NPCs selected.' : 'No gods selected.'}
          </p>
        ) : (
          activeTab.sections.map((section) => (
            <BasketSection key={section.key} level={3} onToggle={onToggle} section={section} />
          ))
        )}
      </div>
    </EditorDialog>
  );
}

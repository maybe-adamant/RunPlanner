import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { AuthoredDraftSpec } from '@run-planner/engine/authored-project';

import type {
  DraftBasketProjection,
  DraftBasketRow,
  DraftBasketSection,
  DraftBasketTab,
  DraftBasketTabKey,
} from '@planner/projections/draftSpec';
import {
  withDraftBasketGiverCleared,
  withDraftBasketTraitToggled,
} from '@planner/projections/draftSpec';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import {
  EditorDialog,
  EditorDialogDraftActions,
  type EditorDialogIssue,
} from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';
import { introducesIssue } from '@planner/ui/controls/introducesIssue';
import { hintProps } from '@planner/ui/controls/hint';
import { DraftCapCount } from './DraftCapCount';

function BasketRows({
  onToggle,
  rows,
}: {
  readonly onToggle: (row: DraftBasketRow) => void;
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
            data-has-icon
            data-refused={(row.inBasket && !row.selectable) || undefined}
            key={row.traitKey}
            onClick={() => {
              if (!unavailable) onToggle(row);
            }}
            type="button"
            {...hintProps(row.selectable ? undefined : row.hint)}
          >
            <ArtworkIcon className="draft-toggle-icon" source={traitIcon(row.traitKey)} />
            {row.label}
            {row.orderNumber === undefined ? null : (
              <span className="draft-order-number" aria-hidden="true">
                {row.orderNumber}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function BasketSection({
  level,
  onClear,
  onToggle,
  orderNotes,
  section,
}: {
  readonly level: 3 | 4;
  readonly onClear: (giverKey: string) => void;
  readonly onToggle: (row: DraftBasketRow) => void;
  readonly orderNotes: ReadonlyMap<string, readonly string[]>;
  readonly section: DraftBasketSection;
}) {
  const Heading = level === 3 ? 'h3' : 'h4';
  return (
    <section
      aria-label={section.label}
      className="draft-basket-section"
      data-level={level}
      id={sectionId(section.key)}
    >
      <Heading className="draft-section-heading">
        {section.label}
        <DraftCapCount cap={section.cap} />
        {section.ordered === true ? (
          <button
            aria-label={`Clear ${section.label} picks`}
            className="draft-reset draft-section-reset"
            disabled={!section.rows.some((row) => row.inBasket)}
            onClick={() => onClear(section.key)}
            type="button"
          >
            <ActionIcon name="reset" />
          </button>
        ) : null}
      </Heading>
      {(orderNotes.get(section.key) ?? []).map((note) => (
        <p className="draft-chip-group-note" key={note}>
          {note}
        </p>
      ))}
      <BasketRows onToggle={onToggle} rows={section.rows} />
      {section.subsections.map((subsection) => (
        <BasketSection
          key={subsection.key}
          level={4}
          onClear={onClear}
          onToggle={onToggle}
          orderNotes={orderNotes}
          section={subsection}
        />
      ))}
    </section>
  );
}

const sectionId = (key: string) => `draft-basket-section-${key}`;

const tabId = (tab: DraftBasketTab['key']) => `draft-basket-tab-${tab}`;

/** The basket's refused traits, keyed by trait; an order refusal reads as its giver's note. */
function refusedIssues(projection: DraftBasketProjection | undefined): EditorDialogIssue[] {
  return (projection?.chipGroups ?? []).flatMap((group) =>
    group.chips
      .filter((chip) => chip.refused)
      .map(
        (chip) =>
          [
            chip.traitKey,
            chip.hint !== undefined
              ? `${chip.label}: ${chip.hint}`
              : (group.orderNotes[0] ?? `Remove ${chip.label}`),
          ] as const,
      ),
  );
}

/**
 * Basket traits in Gods, Bonus and NPC tabs, edited as one draft; a refused trait stays listed but
 * cannot be added.
 */
export function DraftBasketDialog({
  draft: saved,
  initialGiverKey,
  initialTab,
  onClose,
  onSave,
  projectBasket,
  returnFocusId,
}: {
  /** The saved Draft settings. */
  readonly draft: AuthoredDraftSpec;
  /** A giver whose section is brought into view on opening. */
  readonly initialGiverKey?: string | undefined;
  readonly initialTab: DraftBasketTabKey;
  readonly onClose: () => void;
  readonly onSave: (draft: AuthoredDraftSpec) => void;
  /** The basket a Draft settings value shows; undefined while the settings cannot draft. */
  readonly projectBasket: (draft: AuthoredDraftSpec) => DraftBasketProjection | undefined;
  readonly returnFocusId: string;
}) {
  const [draft, setDraft] = useState(saved);
  const atRest = draftValueIdentity(draft) === draftValueIdentity(saved);
  const savedProjection = useMemo(() => projectBasket(saved), [projectBasket, saved]);
  const draftProjection = useMemo(
    () => (atRest ? savedProjection : projectBasket(draft)),
    [atRest, draft, projectBasket, savedProjection],
  );
  const issues = refusedIssues(draftProjection);
  const onToggle = (row: DraftBasketRow) =>
    setDraft(withDraftBasketTraitToggled(draft, row.traitKey, row.giverKey));
  const onClear = (giverKey: string) => setDraft(withDraftBasketGiverCleared(draft, giverKey));
  const [active, setActive] = useState<DraftBasketTab['key']>(initialTab);
  useEffect(() => {
    if (initialGiverKey === undefined) return;
    document.getElementById(sectionId(initialGiverKey))?.scrollIntoView?.({ block: 'nearest' });
  }, [initialGiverKey]);
  const tabRefs = useRef<Partial<Record<DraftBasketTab['key'], HTMLButtonElement | null>>>({});
  if (draftProjection === undefined) return null;
  const projection = draftProjection;
  const orderNotes = new Map(
    projection.chipGroups.map((group) => [group.key, group.orderNotes] as const),
  );
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
      headerBelow={
        <div aria-label="Basket givers" className="draft-basket-segments" role="tablist">
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
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={returnFocusId}
      size="cards"
      title="Basket"
    >
      <EditorDialogDraftActions
        issues={issues}
        onCancel={onClose}
        onSave={() => {
          onSave(draft);
          onClose();
        }}
        // A refusal this draft introduced blocks Save; inherited refusals do not.
        saveDisabled={atRest || introducesIssue(issues, refusedIssues(savedProjection))}
      />
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
            <BasketSection
              key={section.key}
              level={3}
              onClear={onClear}
              onToggle={onToggle}
              orderNotes={orderNotes}
              section={section}
            />
          ))
        )}
      </div>
    </EditorDialog>
  );
}

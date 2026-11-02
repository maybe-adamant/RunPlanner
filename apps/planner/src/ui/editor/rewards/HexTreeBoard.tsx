import type {
  AuthoredHexTreeConfiguration,
  AuthoredHexTreeEdit,
} from '@run-planner/engine/authored-project';
import { Fragment, useEffect, useRef, useState } from 'react';

import type {
  WorkspaceHexColumnDeal,
  WorkspaceHexColumnRow,
  WorkspaceHexColumnSlot,
  WorkspaceHexTreeDomain,
  WorkspaceHexTreeNode,
} from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { hexNodeArtwork } from '@planner/ui/artwork/hex-nodes/hexNodeArtwork';
import { ContextualPicker, ContextualPickerPopover } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';
import { HexBoard } from './HexBoard';
import { HexTreeRulesHelp } from './HexTreeRulesHelp';

/** Pickers with more options than this offer a search box. */
const SEARCH_THRESHOLD = 8;

const hexNodeIcon = (talentKey: string | undefined): string | undefined =>
  talentKey === undefined ? undefined : (hexNodeArtwork[talentKey] ?? undefined);

/** A column being dealt, for the tree it was started on. */
interface Dealing {
  readonly tree: AuthoredHexTreeConfiguration;
  readonly depth: number;
  readonly dealt: readonly string[];
}

const columnControlId = (idBase: string, depth: number) => `${idBase}-column-${depth}`;

/** The tree's layout, chosen from the heading that names the tree; " · " leads it. */
export function HexTreeLayoutPicker({
  domain,
  onEdit,
}: {
  readonly domain: WorkspaceHexTreeDomain;
  readonly onEdit: (edit: AuthoredHexTreeEdit) => void;
}) {
  return (
    <>
      <span aria-hidden="true" className="hex-tree-layout-separator">
        ·
      </span>
      <ContextualPicker
        ariaLabel="Hex talent layout"
        id={`${semanticOwnerControlElementId(domain.address)}-layout`}
        label=""
        model={domain.layoutPicker}
        onSelect={(layoutKey) => {
          onEdit({ kind: 'changeLayout', layoutKey });
        }}
        placeholder="Choose a layout"
        searchable={false}
        triggerSize="content"
      />
    </>
  );
}

/**
 * The planner-owned Hex tree on its native grid: Rare and Epic nodes pick from
 * their pool; Common columns are dealt card by card in their rows.
 */
export function HexTreeBoard({
  domain,
  onEdit,
}: {
  readonly domain: WorkspaceHexTreeDomain;
  readonly onEdit: (edit: AuthoredHexTreeEdit) => void;
}) {
  const findingTarget = useFindingTarget();
  const [openNodeKey, setOpenNodeKey] = useState<string>();
  const [activeItemKey, setActiveItemKey] = useState<string>();
  const [hoveredNodeKey, setHoveredNodeKey] = useState<string>();
  const [dealingState, setDealing] = useState<Dealing>();
  // A deal belongs to the tree it started on.
  const dealing = dealingState?.tree === domain.value ? dealingState : undefined;
  // Pickers stay within the editor rather than overflowing its dialog.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const idBase = semanticOwnerControlElementId(domain.address);
  const byKey = new Map(domain.nodes.map((node) => [node.nodeKey, node]));
  const columnOf = new Map(
    domain.columns.flatMap((row) => row.slots.map((slot) => [slot.nodeKey, row] as const)),
  );
  const dealView = (row: WorkspaceHexColumnRow) =>
    dealing?.depth === row.depth ? row.draw?.deal(dealing.dealt) : undefined;
  const dealtRow = domain.columns.find((row) => row.depth === dealing?.depth);
  const dealtSlots = dealtRow === undefined ? undefined : dealView(dealtRow)?.slots;
  const dealtNodeKeys = new Set(dealtSlots?.map((slot) => slot.nodeKey));
  const nextSlot = dealtSlots?.[dealing!.dealt.length];
  const openEditor = openNodeKey === undefined ? undefined : byKey.get(openNodeKey)?.editor;
  // The nodes the open picker's active choice or the hovered talent involves.
  const involved = new Set([
    ...(activeItemKey === undefined ? [] : (openEditor?.relatedNodeKeys[activeItemKey] ?? [])),
    ...(hoveredNodeKey === undefined ? [] : [hoveredNodeKey]),
  ]);
  const focusColumn = (row: WorkspaceHexColumnRow) => {
    const control = document.getElementById(columnControlId(idBase, row.depth));
    const target =
      control instanceof HTMLButtonElement && !control.disabled
        ? control
        : document.getElementById(`${columnControlId(idBase, row.depth)}-row`);
    target?.focus();
  };
  const nodeContent = (node: WorkspaceHexTreeNode) => (
    <>
      <ArtworkIcon className="hex-tree-node-icon" source={hexNodeIcon(node.talentKey)} />
      <span className="hex-tree-node-label" onMouseEnter={showTruncatedTitle}>
        {node.talentLabel}
      </span>
    </>
  );
  return (
    <div className="hex-tree-editor" ref={setRoot}>
      <HexTreeRulesHelp />
      <HexBoard
        boardProps={{
          'aria-label': `${domain.layoutPicker.selected?.label ?? domain.value.layoutKey} Hex tree`,
          ...findingTarget(domain.address, `${idBase}-board`),
        }}
        linkProps={(_node, next) => ({
          'data-olympian': next.kind.startsWith('olympian') || undefined,
        })}
        nodes={domain.nodes}
        renderNode={(node, style) => {
          const marks = {
            'data-involved': involved.has(node.nodeKey) || undefined,
            // The column being dealt, and the slot its next card fills.
            'data-dealing': dealtSlots === undefined ? undefined : dealtNodeKeys.has(node.nodeKey),
            'data-next-card': nextSlot?.nodeKey === node.nodeKey || undefined,
          };
          const row = columnOf.get(node.nodeKey);
          if (row !== undefined)
            return (
              <button
                aria-label={node.name}
                className="hex-tree-node"
                data-has-findings={node.conflict}
                data-kind={node.kind}
                id={`${idBase}-${node.nodeKey}`}
                key={node.nodeKey}
                onClick={() => focusColumn(row)}
                onMouseEnter={() => setHoveredNodeKey(node.nodeKey)}
                onMouseLeave={() => setHoveredNodeKey(undefined)}
                style={style}
                type="button"
                {...marks}
              >
                {nodeContent(node)}
              </button>
            );
          const editor = node.editor;
          if (editor === undefined)
            return (
              <span
                aria-label={node.name}
                className="hex-tree-node"
                data-kind={node.kind}
                key={node.nodeKey}
                role="note"
                style={style}
                tabIndex={0}
                {...marks}
                {...hintProps(`${node.talentLabel} appears once God Sent is eligible.`)}
              >
                {nodeContent(node)}
              </span>
            );
          const count = editor.model.sections.reduce(
            (sum, section) => sum + section.items.length,
            0,
          );
          return (
            <ContextualPickerPopover
              choiceLabel="talent"
              heading={editor.heading}
              itemIcon={(item) => hexNodeIcon(editor.talentKeys[item.key])}
              key={node.nodeKey}
              model={editor.model}
              onActiveChange={(item) => setActiveItemKey(item?.key)}
              onOpenChange={(next) => {
                setActiveItemKey(undefined);
                setOpenNodeKey(next ? node.nodeKey : undefined);
              }}
              onSelect={onEdit}
              open={openNodeKey === node.nodeKey}
              collisionBoundary={root}
              searchable={count > SEARCH_THRESHOLD}
            >
              <button
                aria-label={node.name}
                className="hex-tree-node"
                data-editing={openNodeKey === node.nodeKey || undefined}
                data-has-findings={node.conflict}
                data-kind={node.kind}
                id={`${idBase}-${node.nodeKey}`}
                style={style}
                type="button"
                {...marks}
              >
                {nodeContent(node)}
              </button>
            </ContextualPickerPopover>
          );
        }}
      />
      <p className="hex-column-legend">
        <span className="hex-column-legend-label">Deck</span>
        {domain.deckLegend.join(' · ')}
      </p>
      <div className="hex-column-scroll">
        <table aria-label="Common columns" className="hex-column-table">
          <tbody>
            {domain.columns.map((row) => {
              const view = dealView(row);
              const id = columnControlId(idBase, row.depth);
              return (
                <tr key={row.depth}>
                  <th id={`${id}-row`} scope="row" tabIndex={-1}>
                    {row.label}
                  </th>
                  <td>
                    <HexColumnDealCell
                      id={id}
                      involved={involved}
                      label={row.label}
                      onCancel={() => setDealing(undefined)}
                      onHover={setHoveredNodeKey}
                      onPick={(talentKey) => {
                        const next = row.draw!.deal([...(view?.dealt ?? []), talentKey]);
                        if (next.edit === undefined)
                          setDealing({ tree: domain.value, depth: row.depth, dealt: next.dealt });
                        else {
                          setDealing(undefined);
                          onEdit(next.edit);
                        }
                      }}
                      onStart={() =>
                        setDealing({ tree: domain.value, depth: row.depth, dealt: [] })
                      }
                      row={row}
                      slots={view?.slots ?? row.slots}
                      view={view}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * A column's talents and its deal: at rest, Deal; while dealing, the next
 * card's choices in the row until the column is full. Escape or Cancel
 * leaves the column as it was.
 */
function HexColumnDealCell({
  id,
  involved,
  label,
  onCancel,
  onHover,
  onPick,
  onStart,
  row,
  slots,
  view,
}: {
  readonly id: string;
  readonly involved: ReadonlySet<string>;
  readonly label: string;
  readonly onCancel: () => void;
  readonly onHover: (nodeKey: string | undefined) => void;
  readonly onPick: (talentKey: string) => void;
  readonly onStart: () => void;
  readonly row: WorkspaceHexColumnRow;
  readonly slots: readonly WorkspaceHexColumnSlot[];
  readonly view: WorkspaceHexColumnDeal | undefined;
}) {
  const cell = useRef<HTMLDivElement>(null);
  const dealing = view !== undefined;
  const dealtCount = view?.dealt.length;
  const wasDealing = useRef(false);
  useEffect(() => {
    const element = cell.current;
    if (element === null) return;
    if (dealing) element.querySelector<HTMLElement>('.hex-column-next button')?.focus();
    else if (wasDealing.current) document.getElementById(id)?.focus();
    wasDealing.current = dealing;
  }, [dealing, dealtCount, id]);
  useEffect(() => {
    const element = cell.current;
    if (!dealing || element === null) return;
    // Escape ends the deal before the dialog sees it.
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    element.addEventListener('keydown', keyDown);
    return () => element.removeEventListener('keydown', keyDown);
  }, [dealing, onCancel]);
  const nextNodeKey = view === undefined ? undefined : slots[view.dealt.length]?.nodeKey;
  return (
    <div className="hex-column-cell" data-dealing={dealing || undefined} ref={cell}>
      <button
        aria-label={`Deal ${label}`}
        aria-pressed={dealing}
        className="hex-column-deal"
        data-has-findings={row.draw?.undrawable === true || undefined}
        disabled={row.draw === undefined}
        id={id}
        onClick={onStart}
        type="button"
        {...hintProps(row.draw === undefined ? candidateWaitingHint : undefined)}
      >
        Deal
      </button>
      <span className="hex-column-dealt">
        <span className="hex-column-slots">
          {slots.map((slot) => (
            <HexColumnSlotChip
              involved={involved.has(slot.nodeKey)}
              key={slot.nodeKey}
              next={slot.nodeKey === nextNodeKey}
              onHover={onHover}
              slot={slot}
            />
          ))}
        </span>
        {view === undefined ? null : (
          <>
            <span aria-label={`Next card for ${label}`} className="hex-column-next" role="group">
              {view.deck.map((segment) => (
                <Fragment key={segment.key}>
                  {segment.refill ? (
                    <span
                      aria-label="Deck refills"
                      className="hex-column-refill"
                      role="img"
                      {...hintProps('Deck refills')}
                    >
                      <ActionIcon name="shuffle" />
                    </span>
                  ) : null}
                  {segment.cards.map((card, index) =>
                    card.pick ? (
                      <button
                        className="hex-column-chip hex-column-option"
                        key={card.talentKey}
                        onClick={() => onPick(card.talentKey)}
                        type="button"
                      >
                        <ArtworkIcon
                          className="hex-column-chip-icon"
                          source={hexNodeIcon(card.talentKey)}
                        />
                        {card.label}
                      </button>
                    ) : (
                      <span
                        className="hex-column-chip"
                        data-unavailable
                        key={`${card.talentKey}-${index}`}
                      >
                        {card.label}
                      </span>
                    ),
                  )}
                </Fragment>
              ))}
            </span>
            <span className="hex-column-count" role="status">
              Dealt {view.dealt.length} of {slots.length}
            </span>
            <button className="hex-column-cancel" onClick={onCancel} type="button">
              Cancel
            </button>
          </>
        )}
      </span>
    </div>
  );
}

/** A column's talent in one slot, or the slot a deal has yet to fill; it marks its node. */
function HexColumnSlotChip({
  involved,
  next,
  onHover,
  slot,
}: {
  readonly involved: boolean;
  /** The slot the deal's next card fills. */
  readonly next: boolean;
  readonly onHover: (nodeKey: string | undefined) => void;
  readonly slot: WorkspaceHexColumnSlot;
}) {
  return (
    <span
      className="hex-column-chip"
      data-empty={slot.talent === undefined || undefined}
      data-next-card={next || undefined}
      data-involved={involved || undefined}
      data-node-key={slot.nodeKey}
      onMouseEnter={() => onHover(slot.nodeKey)}
      onMouseLeave={() => onHover(undefined)}
    >
      {slot.talent === undefined ? null : (
        <>
          <ArtworkIcon
            className="hex-column-chip-icon"
            source={hexNodeIcon(slot.talent.talentKey)}
          />
          {slot.talent.label}
        </>
      )}
    </span>
  );
}

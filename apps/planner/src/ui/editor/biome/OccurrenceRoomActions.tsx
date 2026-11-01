import { FeatureRollEntry } from './commerce/FeatureRollInteract';
import { Fragment, useState, type ReactNode } from 'react';
import {
  requireWorkspaceInteraction,
  workspaceInteractionKey,
  type WorkspaceEncounterBannerSupplement,
  type WorkspaceEncounterPhase,
  type WorkspaceInteractionCatalog,
  type WorkspaceRoomActions,
  type WorkspaceRoomLifecycleBoundary,
  type WorkspaceRoomLifecycleTimelineEntry,
  type WorkspaceShipPhasePresentation,
} from '@planner/projections/structured-workspace';
import {
  useFindingAnchor,
  useFindingMark,
  type FindingMarkProps,
} from '@planner/ui/feedback/useFindingTarget';
import { useCommandIntent } from '@planner/ui/controls/useCommandIntent';
export { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
import { SteadyGrowthEffectRow } from './SteadyGrowthEffectRow';
export { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { TranscendentEmbryoEffectRow } from './TranscendentEmbryoEffectRow';
import { LifecycleBoundaryRow } from './RoomLifecycleBoundaryRow';
import { TimelineRow } from './TimelineRow';
import { RowRewardName } from './RowRewardName';
import { RowNpcName } from './RowNpcName';
import { npcPortrait } from '@planner/ui/artwork/npcs/npcArtwork';
import { FieldsCageOrderControl } from './FieldsCageOrderControl';
import { RoomActionAcquisitionRow } from './RoomActionAcquisitionRow';
import {
  RoomActionInlineEditors,
  RoomActionInlineReward,
  RoomActionVerb,
} from './RoomActionInlineEditors';
import { RoomActionPlacementControl, RoomActionRemovalControl } from './RoomActionOrderingControls';
import { roomActionReorderPositions } from './room-action-placement';
import { TimelineReorderHandle, TimelineReorderStatus } from './TimelineReorderHandle';
import {
  RoomAddArea,
  RoomAddGroupMenu,
  type RoomAddAction,
  type RoomAddGroup,
} from './RoomAddMenu';
import { useTimelineReorder } from './useTimelineReorder';
import { NemesisInteractionEditor, NemesisInteractionPhrase } from './NemesisEventEditor';
import { RoomObjectEntry } from './commerce/RoomObjectEntry';
import { TravelDealLine } from './commerce/PurchaseRowControls';
import { GoldAmount, PurchaseCost, RoomGoldSummary } from './commerce/GoldAmount';
import { hintProps } from '@planner/ui/controls/hint';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { roomActionIcon } from '@planner/ui/artwork/roomArtwork';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
/** Room-owned boundary additions: editors on the boundary row and rows that follow it. */
export interface TimelineBoundaryContent {
  readonly editors?: ReactNode;
  readonly rows?: ReactNode;
}

/** A Mystery Boon whose source the row authors: its picker replaces the name after the verb. */
function inlineMysteryBoonOfferVerb(row: WorkspaceRoomActions['rows'][number]) {
  const mystery =
    row.rewardPayload?.showOffer === true &&
    (row.rewardPayload.control.offer?.rewardType ??
      row.rewardPayload.control.authoringSeed?.rewardType) === 'BlindBoxLoot';
  return mystery ? row.labelParts : undefined;
}

// The Add area: room objects in game order, then optional actions by source family.
const objectOrder = ['worldShop', 'hermesShrine', 'stygianWell', 'purgingPool', 'championItem'];

const objectOfReference = (
  reference: WorkspaceRoomActions['rows'][number]['reference'],
): string | undefined => {
  switch (reference.kind) {
    case 'interactShopOffer':
      return 'worldShop';
    case 'purchaseHermesShrineOffer':
      return 'hermesShrine';
    case 'purchaseStygianWellOffer':
    case 'rerollStygianWell':
      return 'stygianWell';
    case 'sellPurgingPoolTrait':
    case 'rerollPurgingPool':
      return 'purgingPool';
    case 'interactInfernalContractPedestal':
      return 'championItem';
    default:
      return undefined;
  }
};

function WorkbenchAddArea({
  addAction,
  featureRolls,
  interactions,
  objectEntries,
  objectRows,
  optionalRows,
}: {
  /** The timeline's rows, whose purchase, sale and reroll findings mark their object. */
  readonly objectRows: readonly WorkspaceRoomActions['rows'][number][];
  readonly addAction: (row: WorkspaceRoomActions['rows'][number]) => RoomAddAction;
  readonly featureRolls: NonNullable<WorkspaceRoomActions['featureRolls']>;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly objectEntries: NonNullable<WorkspaceRoomActions['objectEntries']>;
  readonly optionalRows: readonly WorkspaceRoomActions['rows'][number][];
}) {
  const findingMark = useFindingMark();
  const objectMark = (object: string): FindingMarkProps | undefined => {
    const marks = objectRows
      .filter((row) => objectOfReference(row.reference) === object)
      .map((row) => findingMark(row.address))
      .filter((mark) => mark['data-has-findings']);
    if (marks.length === 0) return undefined;
    return {
      'data-semantic-owner': marks[0]!['data-semantic-owner'],
      'data-has-findings': true,
      'aria-description': marks.map((mark) => mark['aria-description']).join(' '),
    };
  };
  const withMark = (mark: FindingMarkProps | undefined) =>
    mark === undefined ? {} : { findingMark: mark };
  const groups = new Map<
    string,
    { label: string; object?: string; rows: (typeof optionalRows)[number][] }
  >();
  const rackRows: (typeof optionalRows)[number][] = [];
  for (const row of optionalRows) {
    if (row.reference.kind === 'interactKeepsakeRack') {
      rackRows.push(row);
      continue;
    }
    const group = row.addGroup ?? { key: 'other', label: 'Actions' };
    const entry = groups.get(group.key) ?? {
      label: group.label,
      ...(group.object === undefined ? {} : { object: group.object }),
      rows: [],
    };
    entry.rows.push(row);
    groups.set(group.key, entry);
  }
  const toGroup = (
    key: string,
    entry: { label: string; rows: (typeof optionalRows)[number][] },
  ): RoomAddGroup => ({
    key,
    label: entry.label,
    actions: entry.rows.map(addAction),
  });
  const objectNodes = [
    ...objectEntries.map((entry) => ({
      rank: objectOrder.indexOf(entry.object),
      node: (
        <RoomObjectEntry
          entry={entry}
          {...withMark(objectMark(entry.object))}
          interactions={interactions}
          key={entry.interactionKey}
        />
      ),
    })),
    ...featureRolls.map((rolls) => ({
      rank: objectOrder.indexOf(rolls.feature),
      node: (
        <FeatureRollEntry
          actions={rolls}
          {...withMark(objectMark(rolls.feature))}
          interactions={interactions}
          key={rolls.interactionKey}
        />
      ),
    })),
    // A room object's own optional pickups (a Shrine delivery) sit beside it.
    ...[...groups.entries()]
      .filter(([, entry]) => entry.object !== undefined)
      .map(([key, entry]) => ({
        rank: objectOrder.indexOf(entry.object!) + 0.5,
        node: (
          <li key={key}>
            <RoomAddGroupMenu group={toGroup(key, entry)} />
          </li>
        ),
      })),
    ...rackRows.map((row) => {
      const action = addAction(row);
      return {
        rank: objectOrder.length,
        node: (
          <li key={row.key}>
            <button
              {...action.findingMark}
              {...hintProps(action.unavailable, action.findingMark?.['aria-description'])}
              aria-disabled={action.unavailable === undefined ? undefined : true}
              className="secondary-action action-compact room-add-group"
              onClick={(event) => {
                if (action.unavailable === undefined) action.onSelect(event.currentTarget);
              }}
              type="button"
            >
              {action.icon === undefined ? null : (
                <ArtworkIcon className="artwork-label-icon" source={action.icon} />
              )}
              Keepsake Rack
            </button>
          </li>
        ),
      };
    }),
  ]
    .sort((left, right) => left.rank - right.rank)
    .map((entry) => entry.node);
  return (
    <RoomAddArea
      groups={[...groups.entries()]
        .filter(([, entry]) => entry.object === undefined)
        .map(([key, entry]) => toGroup(key, entry))}
      objects={objectNodes}
    />
  );
}

export function RoomActionsWorkbench({
  actions,
  children,
  encounterPhases,
  idPrefix,
  interactions,
  renderEncounterControls,
  renderRowContent,
  renderBoundaryContent,
  mode,
}: {
  readonly actions?: WorkspaceRoomActions;
  readonly children?: ReactNode;
  readonly encounterPhases?: readonly WorkspaceEncounterPhase[];
  readonly idPrefix?: string;
  readonly interactions: WorkspaceInteractionCatalog;
  /** Encounter/reward owner supplies a banner's encounter controls without a reverse import. */
  readonly renderEncounterControls?: (controls: WorkspaceEncounterBannerSupplement) => ReactNode;
  /** Consumer-owned leaf editor for one exact shared timeline row. */
  readonly renderRowContent?: (row: WorkspaceRoomActions['rows'][number]) => ReactNode;
  readonly renderBoundaryContent?: (
    boundary: WorkspaceRoomLifecycleBoundary,
  ) => TimelineBoundaryContent | undefined;
  readonly mode:
    | { readonly kind: 'roomTimeline' }
    | {
        readonly kind: 'shipPhase';
        readonly phase: WorkspaceShipPhasePresentation;
        /** Every Ship phase, to name the phase a move crosses into. */
        readonly phases: readonly WorkspaceShipPhasePresentation[];
      }
    | {
        readonly kind: 'shipRepairs';
        readonly rows: readonly WorkspaceRoomActions['rows'][number][];
      };
}) {
  const executeIntent = useCommandIntent();
  const findingAnchor = useFindingAnchor();
  const findingMark = useFindingMark();
  const reorder = useTimelineReorder();
  const { attachRoot } = reorder;
  const [announcement, setAnnouncement] = useState('');
  if (actions === undefined && mode.kind === 'roomTimeline') {
    if (encounterPhases === undefined || idPrefix === undefined) return null;
    return (
      <section aria-label="Room Timeline" className="room-actions-workbench">
        {encounterPhases
          .filter((phase) => phase.timelineAnchor !== undefined)
          .map((phase) => (
            <Fragment key={workspaceInteractionKey(phase.address)}>
              {renderEncounterControls?.({ kind: 'encounterStart', phase })}
              {renderEncounterControls?.({ kind: 'encounterEnd', phase })}
            </Fragment>
          ))}
      </section>
    );
  }
  const interaction =
    actions === undefined
      ? undefined
      : requireWorkspaceInteraction(interactions.roomActions, actions.interactionKey);
  const rankedKeys =
    actions?.timeline.entries.flatMap((entry) =>
      entry.kind === 'action' ? [entry.actionKey] : [],
    ) ?? [];
  const rankedRows = actions?.rows.filter((row) => rankedKeys.includes(row.key)) ?? [];
  const apply = (proposalKey: string): void => {
    const proposal = interaction?.proposals.find((candidate) => candidate.key === proposalKey);
    if (interaction === undefined || proposal?.structurallyAuthorable !== true) return;
    executeIntent(interaction.intentFor(proposalKey));
  };
  const checkpointRows = (
    afterRank: number,
    checkpoints: WorkspaceRoomActions['checkpoints'] = actions?.checkpoints ?? [],
  ) =>
    checkpoints
      .filter(
        (checkpoint) =>
          actions?.timeline.suppressedCheckpointKeys.includes(checkpoint.key) !== true,
      )
      .filter((checkpoint) => checkpoint.afterRank === afterRank)
      .map((checkpoint) => (
        <TimelineRow
          key={`checkpoint:${checkpoint.key}`}
          kind="checkpoint"
          label={<strong>{checkpoint.label}</strong>}
        />
      ));
  const renderSupplement = (
    supplement: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'boundary' | 'action' }
    >['supplement'],
  ): ReactNode => {
    if (supplement === undefined) return null;
    if (supplement.kind !== 'nemesisInteraction')
      return renderEncounterControls?.(supplement) ?? null;
    const interaction = interactions.nemesisEvents.get(workspaceInteractionKey(supplement.owner));
    return interaction === undefined ? null : (
      <NemesisInteractionEditor interaction={interaction} />
    );
  };
  const shipPhases = mode.kind === 'shipPhase' ? mode.phases : undefined;
  const phaseOf =
    shipPhases === undefined
      ? undefined
      : (rowKey: string) =>
          shipPhases.find((phase) =>
            phase.timeline.some((entry) => entry.kind === 'action' && entry.actionKey === rowKey),
          )?.label;
  const visibleTimeline =
    mode.kind === 'roomTimeline'
      ? (actions?.timeline.entries ?? [])
      : mode.kind === 'shipPhase'
        ? mode.phase.timeline
        : [];
  const reorderBanners = visibleTimeline.flatMap((entry) =>
    entry.kind === 'boundary'
      ? [
          {
            key: entry.boundary.key,
            label: entry.label,
            kind: entry.boundary.kind,
            dropIndex: entry.dropIndex,
          },
        ]
      : [],
  );
  // Each encounter phase groups its Encounter line, its end and the pickups that follow.
  const phaseByKey = new Map<string, number>();
  {
    let phase: number | undefined;
    let count = 0;
    for (const entry of visibleTimeline) {
      if (entry.kind === 'boundary') {
        if (entry.boundary.kind === 'encounterStart' || entry.boundary.kind === 'roomEntered')
          phase = count++;
        else if (entry.boundary.kind !== 'encounterEnd' && entry.boundary.kind !== 'bossDefeated')
          phase = undefined;
        if (phase !== undefined) phaseByKey.set(entry.boundary.key, phase);
      } else if (entry.kind === 'action' && phase !== undefined) {
        phaseByKey.set(entry.actionKey, phase);
      }
    }
  }
  const renderBoundary = (
    entry: Extract<WorkspaceRoomLifecycleTimelineEntry, { readonly kind: 'boundary' }>,
  ) => {
    const content = renderBoundaryContent?.(entry.boundary);
    const boundary = entry.boundary;
    const modifiers = [renderSupplement(entry.supplement), content?.editors].filter(
      (node) => node !== null && node !== undefined && node !== false,
    );
    // A Nemesis bet settles as its encounter ends.
    const phaseBet =
      boundary.kind === 'encounterEnd'
        ? actions?.phaseGold?.find((bet) => bet.phaseKey === boundary.phaseKey)
        : undefined;
    return (
      <Fragment key={entry.boundary.key}>
        <LifecycleBoundaryRow
          boundary={entry.boundary}
          {...(phaseByKey.get(entry.boundary.key) === undefined
            ? {}
            : { phase: phaseByKey.get(entry.boundary.key)! })}
          {...(modifiers.length === 0
            ? {}
            : {
                controls: modifiers.map((node, index) => <Fragment key={index}>{node}</Fragment>),
              })}
          editors={
            <>
              {/* A banner's gold keeps the money column. */}
              {entry.boundary.kind === 'cleanup' && actions !== undefined ? (
                <RoomGoldSummary
                  {...(actions.current === undefined ? {} : { current: actions.current })}
                />
              ) : null}
              {phaseBet === undefined ? null : (
                <span className="timeline-banner-gold">
                  <GoldAmount
                    amount={phaseBet.gold}
                    className={`timeline-gold-gained${phaseBet.gold.loss ? ' timeline-gold-lost' : ''}`}
                  />
                </span>
              )}
            </>
          }
          label={entry.label}
          {...(entry.fieldsCage === undefined ? {} : { fieldsCage: entry.fieldsCage })}
          {...(entry.supplement?.kind === 'encounterStart' &&
          entry.supplement.identityLabel !== undefined
            ? {
                identity: {
                  label: entry.supplement.identityLabel,
                  owner: entry.supplement.phase.address,
                },
              }
            : {})}
        />
        {content?.rows}
      </Fragment>
    );
  };
  const renderRow = (
    row: WorkspaceRoomActions['rows'][number],
    checkpoints: WorkspaceRoomActions['checkpoints'] = actions?.checkpoints ?? [],
    supplement?: Extract<
      WorkspaceRoomLifecycleTimelineEntry,
      { readonly kind: 'action' }
    >['supplement'],
  ) => {
    if (actions === undefined) return null;
    const nemesisInteraction =
      supplement?.kind === 'nemesisInteraction'
        ? interactions.nemesisEvents.get(workspaceInteractionKey(supplement.owner))
        : undefined;
    const proposals = row.proposalKeys.flatMap((key) => {
      const proposal = actions.proposals.find((candidate) => candidate.key === key);
      return proposal === undefined ? [] : [proposal];
    });
    const portrait = npcPortrait(row.labelParts?.npcKey);
    // A Talk row's portrait names the NPC, so the row leads with no second icon.
    const icon =
      portrait === undefined
        ? roomActionIcon(row.reference, row.address.biomeKey, row.sourceFamily)
        : undefined;
    const mysteryVerb = inlineMysteryBoonOfferVerb(row);
    const placement = row.placement;
    const actionAccent = row.stale
      ? undefined
      : row.participation === 'optional'
        ? row.participationOwnedByOverview && row.rank !== null
          ? 'room'
          : 'optional'
        : row.requiredScope;
    const removeRow = (): void => {
      const removable = proposals.find(
        (proposal) => proposal.kind === 'remove' || proposal.kind === 'unplace',
      );
      if (row.purchaseRemoval !== undefined) {
        executeIntent(row.purchaseRemoval);
        return;
      }
      if (removable?.structurallyAuthorable === true) apply(removable.key);
    };
    const placementControl =
      placement === undefined ? (
        <RoomActionPlacementControl
          findingMark={findingMark(row.address, 'place')}
          onApply={apply}
          proposals={proposals}
          row={row}
        />
      ) : (
        <button
          {...findingMark(row.address, 'place')}
          aria-label={
            row.participation === 'required'
              ? placement.command.kind === 'PlaceHermesShrineDelivery'
                ? 'Restore delivery'
                : 'Restore pickup'
              : 'Take pickup'
          }
          className="secondary-action action-compact"
          onClick={() => executeIntent(placement)}
          type="button"
        >
          {row.participation === 'required' ? 'Restore' : 'Take'}
        </button>
      );
    return (
      <Fragment key={row.key}>
        <TimelineRow
          data-action-accent={actionAccent}
          data-blocking-product={row.blockingProduct}
          data-reorder-anchor={row.rank === null ? undefined : row.key}
          data-phase={phaseByKey.get(row.key)}
          data-in-order={row.rank === null ? 'false' : 'true'}
          data-room-action-key={row.key}
          {...findingAnchor(row.address)}
          tabIndex={-1}
          kind="action"
          handle={
            row.rank !== null ? (
              <TimelineReorderHandle
                findingMark={findingMark(row.address, 'move')}
                item={{
                  key: row.key,
                  label: row.label,
                  positions: roomActionReorderPositions(
                    actions.rows,
                    row,
                    proposals,
                    phaseOf,
                    reorderBanners,
                  ),
                  onMove: apply,
                }}
                session={reorder}
              />
            ) : null
          }
          label={
            <>
              {supplement?.kind === 'nemesisInteraction' && supplement.familyLabel !== undefined ? (
                <>
                  <span className="timeline-row-family">{supplement.familyLabel}</span>
                  <span aria-hidden="true">·</span>
                </>
              ) : null}
              {icon === undefined ? null : (
                <span className="timeline-row-icon">
                  <ArtworkIcon className="artwork-label-icon" source={icon} />
                  {row.travelDeal ? (
                    <ArtworkIcon
                      className="timeline-slot-badge timeline-travel-deal-badge"
                      source={traitIcon('RestockBoon')}
                    />
                  ) : row.slot === undefined ? null : (
                    <span aria-hidden="true" className="timeline-slot-badge">
                      {row.slot}
                    </span>
                  )}
                </span>
              )}
              {nemesisInteraction !== undefined && nemesisInteraction.value !== null ? (
                <NemesisInteractionPhrase interaction={nemesisInteraction} />
              ) : row.labelParts === undefined ? (
                <strong>{row.label}</strong>
              ) : (
                <>
                  {row.labelParts.verb === undefined ? null : (
                    <RoomActionVerb
                      interactions={interactions}
                      row={row}
                      verb={row.labelParts.verb}
                    />
                  )}
                  {mysteryVerb === undefined ? (
                    <strong
                      {...(row.labelParts.origin === undefined ||
                      row.labelParts.reward !== undefined
                        ? {}
                        : {
                            // A name without an icon carries its origin itself, on hover and focus.
                            ...hintProps(row.labelParts.origin),
                            'aria-label': row.labelParts.name,
                            className: 'timeline-row-origin',
                            role: 'group',
                            tabIndex: 0,
                          })}
                    >
                      {row.labelParts.reward === undefined ? (
                        portrait === undefined ? (
                          row.labelParts.name
                        ) : (
                          <RowNpcName name={row.labelParts.name} portrait={portrait} />
                        )
                      ) : (
                        <RowRewardName
                          boosted={row.labelParts.reward.boosted}
                          {...(row.labelParts.reward.itemKey === undefined
                            ? {}
                            : { itemKey: row.labelParts.reward.itemKey })}
                          name={row.labelParts.name}
                          offer={row.labelParts.reward.offer}
                          {...(row.labelParts.origin === undefined
                            ? {}
                            : { origin: row.labelParts.origin })}
                        />
                      )}
                      {row.travelDeal ? (
                        <span className="visually-hidden"> · Travel Deal offer</span>
                      ) : null}
                    </strong>
                  ) : (
                    <>
                      <RowRewardName name="Mystery Boon" offer={{ rewardType: 'BlindBoxLoot' }} />
                      <span aria-hidden="true" className="row-reward-arrow">
                        →
                      </span>
                      <span className="visually-hidden">resolved to</span>
                      <RoomActionInlineReward interactions={interactions} row={row} />
                    </>
                  )}
                  {row.labelParts.tag === undefined ||
                  // A Ship phase tab already names the wheel's phase.
                  (mode.kind === 'shipPhase' &&
                    row.reference.kind === 'interactWheelReward') ? null : (
                    <span className="timeline-row-tag">{row.labelParts.tag}</span>
                  )}
                </>
              )}
              {row.slot === undefined ? null : (
                <span className="visually-hidden">{` · slot ${row.slot}`}</span>
              )}
              {row.stale ? <span className="neutral-status">stale</span> : null}
              {row.rank === null && row.participation === 'required' ? (
                <span className="neutral-status">required</span>
              ) : null}
            </>
          }
          editors={
            <>
              {renderRowContent?.(row)}
              <RoomActionInlineEditors interactions={interactions} row={row} />
              <RoomActionAcquisitionRow
                hideOffer={mysteryVerb !== undefined}
                interactions={interactions}
                row={row}
              />
              {nemesisInteraction === undefined ? (
                renderSupplement(supplement)
              ) : (
                <NemesisInteractionEditor
                  findingMark={(control) => findingMark(row.address, control)}
                  interaction={nemesisInteraction}
                />
              )}
            </>
          }
          money={
            row.goldGained === undefined || row.price !== undefined ? (
              <PurchaseCost
                {...(row.affordability === undefined ? {} : { affordability: row.affordability })}
                {...(row.price === undefined ? {} : { price: row.price })}
              />
            ) : (
              <GoldAmount
                amount={row.goldGained}
                className={`timeline-gold-gained${row.goldGained.loss ? ' timeline-gold-lost' : ''}`}
              />
            )
          }
          placement={placementControl}
          removal={
            <RoomActionRemovalControl
              findingMark={findingMark(row.address, 'delete')}
              onRemove={removeRow}
              proposals={placement === undefined ? proposals : []}
              row={row}
              showRemoval={
                placement === undefined &&
                row.reference.kind !== 'interactKeepsakeRack' &&
                row.reference.kind !== 'interactEris' &&
                (!row.participationOwnedByOverview ||
                  row.stale ||
                  row.purchaseRemoval !== undefined)
              }
            />
          }
        />
        {row.travelDealLine === undefined ? null : (
          <TravelDealLine interactions={interactions} line={row.travelDealLine} />
        )}
        {row.rank === null ? null : checkpointRows(row.rank, checkpoints)}
      </Fragment>
    );
  };
  // An optional action adds in one click where it has one place; otherwise its place is chosen.
  const addAction = (row: WorkspaceRoomActions['rows'][number]): RoomAddAction => {
    const icon = roomActionIcon(row.reference, row.address.biomeKey, row.sourceFamily);
    const base = {
      key: row.key,
      label: row.label,
      address: row.address,
      ...(icon === undefined ? {} : { icon }),
      findingMark: findingMark(row.address, 'place'),
    };
    const placement = row.placement;
    if (placement !== undefined) return { ...base, onSelect: () => executeIntent(placement) };
    const insertions = row.proposalKeys.flatMap((key) => {
      const proposal = actions?.proposals.find(
        (candidate) => candidate.key === key && candidate.kind === 'insert',
      );
      return proposal?.structurallyAuthorable === true ? [proposal] : [];
    });
    if (insertions.length === 0)
      return { ...base, unavailable: 'No position to add this action.', onSelect: () => undefined };
    // A new action appends at its last legal place, as a purchase does; it is then dragged.
    const last = insertions.reduce((latest, proposal) =>
      (proposal.toIndex ?? 0) > (latest.toIndex ?? 0) ? proposal : latest,
    );
    return {
      ...base,
      onSelect: () => {
        apply(last.key);
        setAnnouncement(`${row.label} added to the timeline.`);
      },
    };
  };
  if (mode.kind !== 'roomTimeline') {
    return (
      <section aria-label="Ship combat structure" className="ship-combat-editor">
        <section
          aria-label={actions === undefined ? undefined : 'Room Timeline'}
          className="room-actions-workbench"
          {...(actions === undefined ? {} : findingAnchor(actions.owner))}
          tabIndex={-1}
        >
          <p aria-live="polite" className="visually-hidden">
            {announcement}
          </p>
          <div className="ship-phase-list" ref={attachRoot}>
            {(mode.kind === 'shipPhase' ? [mode.phase] : []).map((phase) => {
              const timelineActionRanks = new Set(
                phase.timeline.flatMap((entry) => (entry.kind === 'action' ? [entry.rank] : [])),
              );
              const renderPhaseTimelineEntry = (
                entry: WorkspaceRoomLifecycleTimelineEntry,
              ): ReactNode[] => {
                if (entry.kind === 'boundary') return [renderBoundary(entry)];
                if (entry.kind === 'automaticEffect') {
                  if (entry.effect === 'steadyGrowth') {
                    const control = actions?.steadyGrowth?.find(
                      (candidate) =>
                        workspaceInteractionKey(candidate.address) ===
                        workspaceInteractionKey(entry.address),
                    );
                    return control === undefined
                      ? []
                      : [
                          <SteadyGrowthEffectRow
                            control={control}
                            interactions={interactions}
                            key={workspaceInteractionKey(control.address)}
                          />,
                        ];
                  }
                  const control = actions?.transcendentEmbryo?.find(
                    (candidate) =>
                      workspaceInteractionKey(candidate.address) ===
                      workspaceInteractionKey(entry.address),
                  );
                  return control === undefined
                    ? []
                    : [
                        <TranscendentEmbryoEffectRow
                          control={control}
                          interactions={interactions}
                          key={workspaceInteractionKey(control.address)}
                        />,
                      ];
                }
                if (entry.presentation !== 'row') return [];
                const row = actions?.rows.find((candidate) => candidate.key === entry.actionKey);
                return row === undefined
                  ? []
                  : [
                      <Fragment key={entry.actionKey}>
                        {renderRow(row, phase.checkpoints, entry.supplement)}
                      </Fragment>,
                    ];
              };
              const trailingCheckpoints = phase.checkpoints.filter(
                (checkpoint) =>
                  actions?.timeline.suppressedCheckpointKeys.includes(checkpoint.key) !== true &&
                  checkpoint.afterRank !== 0 &&
                  !timelineActionRanks.has(checkpoint.afterRank),
              );
              return (
                <section
                  aria-label={`${phase.label} ship phase`}
                  className="ship-phase"
                  key={phase.key}
                >
                  <div className="room-timeline-main">
                    {phase.actionRows.length === 0 &&
                    phase.checkpoints.length === 0 &&
                    phase.timeline.length === 0 ? null : (
                      <ol aria-label={`${phase.label} timeline`} className="room-action-list">
                        {checkpointRows(0, phase.checkpoints)}
                        {phase.timeline.flatMap(renderPhaseTimelineEntry)}
                        {trailingCheckpoints.map((checkpoint) => (
                          <TimelineRow
                            key={`checkpoint:${checkpoint.key}`}
                            kind="checkpoint"
                            label={<strong>{checkpoint.label}</strong>}
                          />
                        ))}
                      </ol>
                    )}
                    {phase.unplacedRows.length === 0 ? null : (
                      <section aria-label="Required actions" className="room-action-optional-pool">
                        <div className="local-reward-heading">
                          <h5>Required actions</h5>
                        </div>
                        <ol
                          aria-label={`${phase.label} required actions`}
                          className="room-action-list"
                        >
                          {phase.unplacedRows.map((row) => renderRow(row, phase.checkpoints))}
                        </ol>
                      </section>
                    )}
                  </div>
                  <WorkbenchAddArea
                    addAction={addAction}
                    featureRolls={[]}
                    interactions={interactions}
                    objectEntries={phase.objectEntries ?? []}
                    objectRows={phase.actionRows}
                    optionalRows={phase.optionalRows}
                  />
                </section>
              );
            })}
            {mode.kind !== 'shipRepairs' || mode.rows.length === 0 ? null : (
              <section aria-label="Ship action repairs" className="ship-action-repairs">
                <div className="local-reward-heading">
                  <h4>Inactive actions</h4>
                </div>
                <ol aria-label="Inactive Ship actions" className="room-action-list">
                  {mode.rows.map((row) => renderRow(row, []))}
                </ol>
              </section>
            )}
          </div>
          <TimelineReorderStatus session={reorder} />
        </section>
      </section>
    );
  }
  if (actions === undefined) return null;
  const actionByKey = new Map(actions.rows.map((row) => [row.key, row]));
  const timelineRows = actions.timeline.entries.flatMap((entry) => {
    if (entry.kind === 'boundary') {
      return [renderBoundary(entry)];
    }
    if (entry.kind === 'automaticEffect') {
      if (entry.effect === 'steadyGrowth') {
        const control = actions.steadyGrowth?.find(
          (candidate) =>
            workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
        );
        return control === undefined
          ? []
          : [
              <SteadyGrowthEffectRow
                control={control}
                interactions={interactions}
                key={workspaceInteractionKey(control.address)}
              />,
            ];
      }
      const control = actions.transcendentEmbryo?.find(
        (candidate) =>
          workspaceInteractionKey(candidate.address) === workspaceInteractionKey(entry.address),
      );
      return control === undefined
        ? []
        : [
            <TranscendentEmbryoEffectRow
              control={control}
              interactions={interactions}
              key={workspaceInteractionKey(control.address)}
            />,
          ];
    }
    if (entry.presentation !== 'row') return [];
    const row = actionByKey.get(entry.actionKey);
    return row === undefined
      ? []
      : [<Fragment key={entry.actionKey}>{renderRow(row, [], entry.supplement)}</Fragment>];
  });
  return (
    <section
      aria-label="Room Timeline"
      className="room-actions-workbench"
      {...findingAnchor(actions.owner)}
      tabIndex={-1}
    >
      {/* The timeline and its repairs form one column; the Add area sits beside or below it. */}
      <div className="room-timeline-main">
        <p aria-live="polite" className="visually-hidden">
          {announcement}
        </p>
        {actions.timeline.fieldsCageOrder === undefined || interaction === undefined ? null : (
          <FieldsCageOrderControl
            control={actions.timeline.fieldsCageOrder}
            id={`${idPrefix ?? 'room-actions'}-cage-order`}
            interaction={interaction}
          />
        )}
        <ol aria-label="Room timeline" className="room-action-list" ref={attachRoot}>
          {timelineRows}
          {rankedRows.length === 0 ? checkpointRows(0) : null}
        </ol>
        {children}
        {actions.repairRows.length === 0 ? null : (
          <section aria-label="Timeline repairs" className="room-action-repairs">
            <div className="local-reward-heading">
              <h5>Timeline repairs</h5>
            </div>
            <ol aria-label="Timeline repairs" className="room-action-list">
              {actions.repairRows.map((row) => renderRow(row))}
            </ol>
          </section>
        )}
        <TimelineReorderStatus session={reorder} />
      </div>
      <WorkbenchAddArea
        addAction={addAction}
        featureRolls={actions.featureRolls ?? []}
        interactions={interactions}
        objectEntries={actions.objectEntries ?? []}
        objectRows={actions.rows}
        optionalRows={actions.optionalRows}
      />
    </section>
  );
}

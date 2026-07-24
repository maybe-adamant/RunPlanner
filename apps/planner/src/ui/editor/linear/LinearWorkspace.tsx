import {
  semanticAddressKey,
  type LinearBiomePlan,
  type OccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { LinearBiomeProjectEvaluation } from '@run-planner/engine/simulation';
import type { ReactNode } from 'react';

import type {
  StructuredWorkspaceProjection,
  WorkspaceInspectorDestination,
  WorkspaceInteractionCatalog,
  WorkspaceLinearBiome,
  WorkspaceLinearDecision,
  WorkspaceMarker,
} from '../../../projections/structuredWorkspace';
import { semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '../../../state/store';
import { FindingCount, SemanticOwnerMarker } from '../../feedback/EvaluationFeedback';
import { LinearBiomeEditor } from './LinearBiomeEditor';

interface LinearWorkspaceProps {
  readonly catalog: Catalog;
  readonly evaluation: LinearBiomeProjectEvaluation | undefined;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly plan: LinearBiomePlan;
  readonly projection: WorkspaceLinearBiome;
  readonly routeKey: string;
  readonly workspace: StructuredWorkspaceProjection;
}

function assessmentLabel(marker: WorkspaceMarker, findingCount = marker.findingCount): string {
  switch (marker.assessment) {
    case 'assessed':
      return findingCount === 0 ? 'Assessed' : 'Needs attention';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Unassessed';
  }
}

function FocusButton({
  children,
  className,
  findingCount,
  marker,
  selected,
}: {
  readonly children: ReactNode;
  readonly className: string;
  readonly findingCount?: number;
  readonly marker: WorkspaceMarker;
  readonly selected: boolean;
}) {
  const dispatch = useAppDispatch();
  return (
    <button
      aria-pressed={selected}
      className={className}
      data-assessment={marker.assessment}
      data-findings={(findingCount ?? marker.findingCount) > 0}
      data-selected={selected}
      data-workspace-node={marker.focusKey}
      onClick={() => dispatch(semanticOwnerFocused(marker.address))}
      type="button"
    >
      {children}
    </button>
  );
}

function MarkerSummary({
  marker,
  findingCount = marker.findingCount,
}: {
  readonly findingCount?: number;
  readonly marker: WorkspaceMarker;
}) {
  return (
    <span className="linear-node-meta">
      <span>{assessmentLabel(marker, findingCount)}</span>
      <FindingCount count={findingCount} label="findings" />
    </span>
  );
}

function compactStatusLabel(marker: WorkspaceMarker, findingCount = marker.findingCount): string {
  if (findingCount > 0) {
    return `Findings · ${findingCount}`;
  }
  switch (marker.assessment) {
    case 'assessed':
      return 'Assessed';
    case 'blocked':
      return 'Blocked';
    case 'unassessed':
      return 'Unassessed';
  }
}

function CompactNodeHeading({
  findingCount,
  label,
  marker,
}: {
  readonly findingCount?: number;
  readonly label: string;
  readonly marker: WorkspaceMarker;
}) {
  return (
    <span className="linear-node-status">
      {label} — {compactStatusLabel(marker, findingCount)}
    </span>
  );
}

function defaultMarker(projection: WorkspaceLinearBiome): WorkspaceMarker {
  if (projection.frontier !== null) {
    return projection.frontier;
  }
  if (projection.terminal.realization !== 'projected') {
    return projection.terminal.marker;
  }
  const lastPicked = projection.decisions
    .flatMap((decision) => decision.targets)
    .filter((target) => target.picked)
    .at(-1);
  return lastPicked?.room.marker ?? projection.entries[0]?.marker ?? projection.marker;
}

function useDestinationForFocus(
  workspace: StructuredWorkspaceProjection,
  projection: WorkspaceLinearBiome,
  routeKey: string,
): WorkspaceInspectorDestination | undefined {
  const focusedOwner = useAppSelector((state) => state.editorSession.focusedSemanticOwner);
  if (
    focusedOwner === null ||
    !('biomeKey' in focusedOwner) ||
    focusedOwner.routeKey !== routeKey ||
    focusedOwner.biomeKey !== projection.biomeKey
  ) {
    return undefined;
  }
  return workspace.focusByOwner.get(semanticAddressKey(focusedOwner));
}

function projectionSourceLabel(source: WorkspaceLinearBiome['source']): string {
  switch (source) {
    case 'authored':
      return 'Authored';
    case 'canonical':
      return 'Complete';
    case 'progressive':
      return 'Evaluated prefix';
  }
}

function roleLabel(role: string): string {
  return role === 'postboss' ? 'Postboss' : `${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

function continuationParent(address: SemanticAddress): OccurrenceId | null | undefined {
  switch (address.kind) {
    case 'continuation':
    case 'batchRewardStore':
    case 'picked':
    case 'target':
      return address.parentOccurrenceId;
    default:
      return undefined;
  }
}

function decisionOwnsNode(
  decision: WorkspaceLinearDecision,
  nodeKey: string,
  focusAddress: SemanticAddress,
): boolean {
  return (
    continuationParent(focusAddress) === decision.parentOccurrenceId ||
    decision.marker.focusKey === nodeKey ||
    decision.pickedMarker.focusKey === nodeKey ||
    decision.rewardStoreMarker.focusKey === nodeKey ||
    decision.targets.some(
      (target) => target.marker.focusKey === nodeKey || target.room.marker.focusKey === nodeKey,
    )
  );
}

function focusedDecision(
  projection: WorkspaceLinearBiome,
  nodeKey: string,
  focusAddress: SemanticAddress,
): { readonly decision: WorkspaceLinearDecision; readonly index: number } | undefined {
  const index = projection.decisions.findIndex((decision) =>
    decisionOwnsNode(decision, nodeKey, focusAddress),
  );
  const decision = projection.decisions[index];
  return decision === undefined ? undefined : { decision, index };
}

function singleRewardSummary(
  catalog: Catalog,
  target: WorkspaceLinearDecision['targets'][number] | undefined,
): string | undefined {
  if (target?.room.rewardSummary === undefined) {
    return undefined;
  }
  const controls = target.room.rewardControls;
  if (controls.length === 1) {
    return controls[0]?.offer.payload?.kind === 'DevotionPair'
      ? undefined
      : target.room.rewardSummary;
  }
  const declaration = catalog.rooms.byKey[target.room.gameName];
  return controls.length === 0 && declaration?.incomingReward.kind === 'fixed'
    ? target.room.rewardSummary
    : undefined;
}

function DecisionSummary({
  catalog,
  decision,
  index,
  selected,
}: {
  readonly catalog: Catalog;
  readonly decision: WorkspaceLinearDecision;
  readonly index: number;
  readonly selected: boolean;
}) {
  const picked = decision.targets.find((target) => target.picked);
  const reward = singleRewardSummary(catalog, picked);
  return (
    <FocusButton
      className="linear-decision-node"
      findingCount={decision.findingCount}
      marker={decision.marker}
      selected={selected}
    >
      <CompactNodeHeading
        findingCount={decision.findingCount}
        label={`Decision ${index + 1}`}
        marker={decision.marker}
      />
      <strong>{picked?.room.label ?? 'Choose a continuation'}</strong>
      {reward === undefined ? null : <span className="linear-picked-reward">{reward}</span>}
      {decision.retainedOverflow ? (
        <span className="linear-retained-label">Retained downstream</span>
      ) : null}
    </FocusButton>
  );
}

function terminalOwnsFocus(
  projection: WorkspaceLinearBiome,
  nodeKey: string,
  focusAddress: SemanticAddress,
): boolean {
  if (projection.terminal.realization === 'projected') {
    return false;
  }
  const terminalParent =
    projection.terminal.marker.address.kind === 'continuation'
      ? projection.terminal.marker.address.parentOccurrenceId
      : undefined;
  return (
    (terminalParent !== undefined && continuationParent(focusAddress) === terminalParent) ||
    projection.terminal.marker.focusKey === nodeKey ||
    projection.terminal.targets.some(
      (target) => target.marker.focusKey === nodeKey || target.room.marker.focusKey === nodeKey,
    )
  );
}

function focusedLabel(
  projection: WorkspaceLinearBiome,
  nodeKey: string,
  focusAddress: SemanticAddress,
): string {
  const focused = focusedDecision(projection, nodeKey, focusAddress);
  if (focused !== undefined) {
    return `Decision ${focused.index + 1}`;
  }
  for (const entry of projection.entries) {
    if (entry.marker.focusKey === nodeKey || entry.room?.marker.focusKey === nodeKey) {
      return entry.room?.label ?? 'Starting room';
    }
  }
  if (terminalOwnsFocus(projection, nodeKey, focusAddress)) {
    return 'Terminal decision';
  }
  if (projection.frontier?.focusKey === nodeKey) {
    return 'Active frontier';
  }
  const completion = projection.completion.find((entry) => entry.marker.focusKey === nodeKey);
  if (completion !== undefined) {
    return completion.label;
  }
  return projection.label;
}

export function LinearWorkspace({
  catalog,
  evaluation,
  interactions,
  plan,
  projection,
  routeKey,
  workspace,
}: LinearWorkspaceProps) {
  const requestedDestination = useDestinationForFocus(workspace, projection, routeKey);
  const fallback = defaultMarker(projection);
  const layout = catalog.biomeLayouts.byKey[projection.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new Error(`${projection.biomeKey} has no Linear layout`);
  }
  const requestedNodeKey = requestedDestination?.nodeKey;
  const requestedAddress = requestedDestination?.focusAddress;
  const requestedIsFocusable =
    requestedNodeKey !== undefined &&
    requestedAddress !== undefined &&
    ((layout.fields.length > 0 && requestedNodeKey === projection.marker.focusKey) ||
      projection.entries.some(
        (entry) =>
          entry.marker.focusKey === requestedNodeKey ||
          entry.room?.marker.focusKey === requestedNodeKey,
      ) ||
      focusedDecision(projection, requestedNodeKey, requestedAddress) !== undefined ||
      terminalOwnsFocus(projection, requestedNodeKey, requestedAddress) ||
      projection.frontier?.focusKey === requestedNodeKey ||
      projection.completion.some((entry) => entry.marker.focusKey === requestedNodeKey));
  const focusedNodeKey = requestedIsFocusable ? requestedNodeKey : fallback.focusKey;
  const focusedAddress = requestedIsFocusable ? requestedAddress : fallback.address;
  const independentTerminal = projection.terminal.realization === 'independent';
  const focusedCompletion = projection.completion.find(
    (landmark) => landmark.marker.focusKey === focusedNodeKey,
  );
  const activeDecision = focusedDecision(projection, focusedNodeKey, focusedAddress);
  const terminalSelected = terminalOwnsFocus(projection, focusedNodeKey, focusedAddress);
  const frontierClaimed =
    projection.frontier !== null &&
    (focusedDecision(projection, projection.frontier.focusKey, projection.frontier.address) !==
      undefined ||
      terminalOwnsFocus(projection, projection.frontier.focusKey, projection.frontier.address));
  const pickedTerminal = projection.terminal.targets.find((target) => target.picked);
  const terminalReward = singleRewardSummary(catalog, pickedTerminal);

  return (
    <div className="linear-workspace">
      <section
        aria-label={`${projection.label} structure`}
        className="linear-structure-region"
        data-source={projection.source}
      >
        <header className="linear-structure-heading">
          <div>
            <p className="eyebrow">Biome structure</p>
            <h2>{projection.label}</h2>
          </div>
          <span className="neutral-status">{projectionSourceLabel(projection.source)}</span>
        </header>

        <div className="linear-spine">
          {layout.fields.length === 0 ? null : (
            <div className="linear-spine-stop">
              <FocusButton
                className="linear-entry-node"
                marker={projection.marker}
                selected={focusedNodeKey === projection.marker.focusKey}
              >
                <CompactNodeHeading label="Biome" marker={projection.marker} />
                <strong>Biome settings</strong>
              </FocusButton>
            </div>
          )}

          {projection.entries.map((entry) => {
            const marker = entry.room?.marker ?? entry.marker;
            return (
              <div className="linear-spine-stop" key={entry.key}>
                <FocusButton
                  className="linear-entry-node"
                  marker={marker}
                  selected={focusedNodeKey === marker.focusKey}
                >
                  <CompactNodeHeading label={roleLabel(entry.role)} marker={marker} />
                  <strong>{entry.room?.label ?? 'Choose starting room'}</strong>
                </FocusButton>
              </div>
            );
          })}

          {projection.decisions.map((decision, decisionIndex) => (
            <div
              className="linear-decision-stop"
              data-retained={decision.retainedOverflow}
              key={decision.marker.focusKey}
            >
              <DecisionSummary
                catalog={catalog}
                decision={decision}
                index={decisionIndex}
                selected={activeDecision?.decision === decision}
              />
            </div>
          ))}

          {projection.frontier === null || frontierClaimed ? null : (
            <div className="linear-spine-stop">
              <FocusButton
                className="linear-frontier-node"
                marker={projection.frontier}
                selected={focusedNodeKey === projection.frontier.focusKey}
              >
                <CompactNodeHeading label="Coverage frontier" marker={projection.frontier} />
                <strong>Continue authoring here</strong>
              </FocusButton>
            </div>
          )}

          <section
            className="linear-terminal-stop"
            data-realization={projection.terminal.realization}
          >
            {independentTerminal ? (
              <FocusButton
                className="linear-terminal-node"
                findingCount={projection.terminal.findingCount}
                marker={projection.terminal.marker}
                selected={terminalSelected}
              >
                <CompactNodeHeading
                  findingCount={projection.terminal.findingCount}
                  label="Terminal decision"
                  marker={projection.terminal.marker}
                />
                <strong>{pickedTerminal?.room.label ?? projection.terminal.outline.label}</strong>
                {terminalReward === undefined ? null : (
                  <span className="linear-picked-reward">{terminalReward}</span>
                )}
              </FocusButton>
            ) : (
              <div className="linear-terminal-node linear-readonly-node">
                <span className="linear-node-status">
                  {projection.terminal.realization === 'projected'
                    ? 'Terminal outline — Not authored'
                    : 'Generated terminal peer — Derived'}
                </span>
                <strong>{projection.terminal.outline.label}</strong>
              </div>
            )}
          </section>

          {projection.completion.length === 0 ? null : (
            <div className="linear-completion-landmarks" aria-label="Completion landmarks">
              {projection.completion.map((landmark) => (
                <div className="linear-completion-node" key={landmark.marker.focusKey}>
                  <CompactNodeHeading label={roleLabel(landmark.role)} marker={landmark.marker} />
                  <strong>{landmark.label}</strong>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <aside aria-label="Focused inspector" className="linear-inspector">
        <header className="linear-inspector-heading">
          <p className="eyebrow">Focused inspector</p>
          <h2>{focusedLabel(projection, focusedNodeKey, focusedAddress)}</h2>
        </header>
        {focusedCompletion === undefined ? (
          <LinearBiomeEditor
            catalog={catalog}
            embedded={true}
            evaluation={evaluation}
            focusedNodeKey={focusedNodeKey}
            interactions={interactions}
            plan={plan}
            routeKey={routeKey}
          />
        ) : (
          <article className="linear-landmark-inspector">
            <p className="card-kicker">{roleLabel(focusedCompletion.role)}</p>
            <h3>{focusedCompletion.label}</h3>
            <SemanticOwnerMarker address={focusedCompletion.marker.address} />
            <p>
              This completion room is derived from the biome layout and is not an authored room
              occurrence.
            </p>
            <MarkerSummary marker={focusedCompletion.marker} />
          </article>
        )}
      </aside>
    </div>
  );
}

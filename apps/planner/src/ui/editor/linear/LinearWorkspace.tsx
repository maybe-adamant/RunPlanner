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
      <span className="linear-decision-heading">
        <span className="card-kicker">Decision {index + 1}</span>
        <span className="linear-exit-count">
          {decision.targets.length} {decision.targets.length === 1 ? 'offer' : 'offers'}
        </span>
      </span>
      <strong>{picked?.room.label ?? 'Choose a continuation'}</strong>
      {reward === undefined ? null : <span className="linear-picked-reward">{reward}</span>}
      {decision.retainedOverflow ? (
        <span className="linear-retained-label">Retained downstream</span>
      ) : null}
      <MarkerSummary findingCount={decision.findingCount} marker={decision.marker} />
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

function OutlineSummary({ projection }: { readonly projection: WorkspaceLinearBiome }) {
  const progression = projection.emptyOutline.progression;
  let copy: string;
  switch (progression.kind) {
    case 'exact':
      copy = `${progression.decisionCount} declared decisions`;
      break;
    case 'staged':
      copy = `${progression.stageKeys.length} declared stages`;
      break;
    case 'variable':
      copy = 'Route length varies';
      break;
    case 'hubVisits':
      copy = `${progression.visitCount} visits`;
      break;
  }
  return (
    <p className="linear-outline-summary">
      {copy}. Terminal role: {projection.emptyOutline.terminal.label}.
    </p>
  );
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

        <OutlineSummary projection={projection} />

        <div className="linear-spine">
          {layout.fields.length === 0 ? null : (
            <div className="linear-spine-stop">
              <FocusButton
                className="linear-entry-node"
                marker={projection.marker}
                selected={focusedNodeKey === projection.marker.focusKey}
              >
                <span className="card-kicker">Biome</span>
                <strong>Biome settings</strong>
                <MarkerSummary marker={projection.marker} />
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
                  <span className="card-kicker">{roleLabel(entry.role)}</span>
                  <strong>{entry.room?.label ?? 'Choose starting room'}</strong>
                  <MarkerSummary marker={marker} />
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
                <span className="card-kicker">Coverage frontier</span>
                <strong>Continue authoring here</strong>
                <MarkerSummary marker={projection.frontier} />
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
                <span className="card-kicker">Terminal decision</span>
                <strong>{pickedTerminal?.room.label ?? projection.terminal.outline.label}</strong>
                {terminalReward === undefined ? null : (
                  <span className="linear-picked-reward">{terminalReward}</span>
                )}
                <MarkerSummary
                  findingCount={projection.terminal.findingCount}
                  marker={projection.terminal.marker}
                />
              </FocusButton>
            ) : (
              <div className="linear-terminal-node linear-readonly-node">
                <span className="card-kicker">
                  {projection.terminal.realization === 'projected'
                    ? 'Terminal outline'
                    : 'Generated terminal peer'}
                </span>
                <strong>{projection.terminal.outline.label}</strong>
                <span className="linear-node-meta">
                  {projection.terminal.realization === 'projected'
                    ? 'Not authored yet'
                    : 'Shown in its generated decision'}
                </span>
              </div>
            )}
          </section>

          {projection.completion.length === 0 ? null : (
            <div className="linear-completion-landmarks" aria-label="Completion landmarks">
              {projection.completion.map((landmark) => (
                <div className="linear-completion-node" key={landmark.marker.focusKey}>
                  <span className="card-kicker">{roleLabel(landmark.role)}</span>
                  <strong>{landmark.label}</strong>
                  <MarkerSummary marker={landmark.marker} />
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

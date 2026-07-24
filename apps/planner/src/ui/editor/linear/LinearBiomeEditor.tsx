import type { LinearBiomeProjectEvaluation } from '@run-planner/engine/simulation';
import type { Catalog, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type { LinearBiomePlan } from '@run-planner/engine/authored-project';
import {
  createBiomeAddress,
  createContinuationAddress,
  createFixedEntryRewardAddress,
  createFixedEntryRoomAddress,
  createOccurrenceAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { type WorkspaceInteractionCatalog } from '../../../projections/structuredWorkspace';
import { allocateOccurrenceId } from '../../../workspace/occurrenceIds';
import { presentBiomeStatus } from '../../../projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '../../../state/projectWorkspaceSlice';
import { useAppDispatch } from '../../../state/store';
import { LinearTopologyEditor } from './LinearTopologyEditor';
import {
  SemanticFindingsScope,
  SemanticOwnerMarker,
  StatusBadge,
} from '../../feedback/EvaluationFeedback';
import { RoomStateEditor } from '../rooms/RoomStateEditor';
import { RoomSelector } from './RoomSelector';

interface LinearBiomeEditorProps {
  readonly catalog: Catalog;
  readonly embedded?: boolean;
  readonly evaluation: LinearBiomeProjectEvaluation | undefined;
  readonly focusedNodeKey?: string;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly plan: LinearBiomePlan;
  readonly routeKey: string;
}

function startRooms(catalog: Catalog, biomeKey: string): readonly RoomDeclaration[] {
  const layout = catalog.biomeLayouts.byKey[biomeKey];
  if (layout === undefined) {
    throw new Error(`${biomeKey} layout is missing`);
  }
  if (layout.kind !== 'LinearBiome') {
    throw new Error(`${biomeKey} is not a linear biome`);
  }
  if (layout.start.kind !== 'authoredStart') {
    throw new Error(`${biomeKey} does not expose an authored start`);
  }
  return layout.start.roomGameNames.map((gameName) => {
    const room = catalog.rooms.byKey[gameName];
    if (room === undefined) {
      throw new Error(`${biomeKey} start room ${gameName} is missing`);
    }
    return room;
  });
}

function startDeclaration(catalog: Catalog, gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new Error(`Starting room ${gameName} is missing`);
  }
  return room;
}

export function LinearBiomeEditor({
  catalog,
  embedded = false,
  evaluation,
  focusedNodeKey,
  interactions,
  plan,
  routeKey,
}: LinearBiomeEditorProps) {
  const dispatch = useAppDispatch();
  const biomeDeclaration = catalog.biomes.byKey[plan.biomeKey];
  if (biomeDeclaration === undefined) {
    throw new Error(`${plan.biomeKey} biome declaration is missing`);
  }
  if (evaluation !== undefined && evaluation.biomeKey !== plan.biomeKey) {
    throw new Error(`${plan.biomeKey} editor received ${evaluation.biomeKey} evaluation`);
  }
  const biomeLabel = biomeDeclaration.label;
  const titleId = `${plan.biomeKey.toLowerCase()}-biome-title`;
  const startRoomId = `${plan.biomeKey.toLowerCase()}-starting-room`;
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const topology = plan.topology;
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    throw new Error(`${plan.biomeKey} is not a linear biome`);
  }

  if (layout.start.kind === 'fixedEntry') {
    const fixedEntries = [
      layout.start,
      ...layout.entries.map((entry) => {
        if (entry.kind !== 'fixedEntry') {
          throw new Error(`${plan.biomeKey} has a non-fixed entry`);
        }
        return entry;
      }),
    ];
    const fixedSourceDescriptor = fixedEntries.at(-1);
    const fixedSourceRoom =
      fixedSourceDescriptor === undefined
        ? undefined
        : catalog.rooms.byKey[fixedSourceDescriptor.roomGameName];
    if (fixedSourceRoom === undefined) {
      throw new Error(`${plan.biomeKey} has no fixed continuation source`);
    }
    return (
      <SemanticFindingsScope findings={evaluation?.findings ?? []}>
        <section className="biome-editor" {...(embedded ? {} : { 'aria-labelledby': titleId })}>
          <header className="panel-heading">
            {embedded ? null : (
              <div>
                <p className="eyebrow">
                  {routeKey} · {plan.biomeKey}
                </p>
                <h2 id={titleId}>{biomeLabel}</h2>
              </div>
            )}
            <div className="panel-heading-actions">
              <SemanticOwnerMarker address={biome} />
              <StatusBadge status={presentBiomeStatus(evaluation)} />
              {topology !== null && (
                <button
                  className="danger-action"
                  onClick={() => {
                    if (
                      !globalThis.confirm(`Clear all authored ${biomeLabel} rooms and rewards?`)
                    ) {
                      return;
                    }
                    dispatch(authoredProjectCommandDispatched({ kind: 'ClearTopology', biome }));
                  }}
                  type="button"
                >
                  Clear {biomeLabel}
                </button>
              )}
            </div>
          </header>

          <div className="fixed-entry-list" aria-label="Fixed biome entries" role="group">
            {fixedEntries.map((entry) => {
              const room = catalog.rooms.byKey[entry.roomGameName];
              if (room === undefined) {
                throw new Error(`${entry.roomGameName} fixed entry is missing`);
              }
              const entryAddress = createFixedEntryRoomAddress(biome, entry.role);
              if (
                focusedNodeKey !== undefined &&
                focusedNodeKey !== semanticAddressKey(entryAddress)
              ) {
                return null;
              }
              return (
                <article className="room-card" key={entry.role}>
                  <div className="room-card-heading">
                    <div>
                      <p className="card-kicker">Fixed {entry.role}</p>
                      <h3>{room.label}</h3>
                    </div>
                    <span className="room-kind">{room.kind}</span>
                    <SemanticOwnerMarker address={entryAddress} />
                  </div>
                  {room.incomingReward.kind === 'fixed' && (
                    <div className="room-state-with-marker">
                      <SemanticOwnerMarker
                        address={createFixedEntryRewardAddress(biome, entry.role)}
                      />
                      <p className="fixed-room-state">
                        Fixed reward: {room.incomingReward.offer.rewardType}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {topology === null &&
          (focusedNodeKey === undefined ||
            focusedNodeKey === semanticAddressKey(createContinuationAddress(biome, null))) ? (
            <section className="frontier-actions">
              <div>
                <div className="owner-markers frontier-owner">
                  <p className="card-kicker">Active frontier</p>
                  <SemanticOwnerMarker address={createContinuationAddress(biome, null)} />
                </div>
                <h3>Continue from {fixedSourceRoom.label}</h3>
                <p>The first Clockwork decision follows the fixed biome entries.</p>
              </div>
              <div className="frontier-buttons">
                <button
                  className="primary-action"
                  onClick={() =>
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'CreateBatch',
                        continuation: createContinuationAddress(biome, null),
                      }),
                    )
                  }
                  type="button"
                >
                  Add Next Decision
                </button>
              </div>
            </section>
          ) : topology !== null ? (
            <LinearTopologyEditor
              biome={biome}
              catalog={catalog}
              evaluation={evaluation}
              {...(focusedNodeKey === undefined ? {} : { focusedNodeKey })}
              interactions={interactions}
              plan={plan}
              topology={topology}
            />
          ) : null}
        </section>
      </SemanticFindingsScope>
    );
  }

  const options = startRooms(catalog, plan.biomeKey);
  const authoredStartKind = options.every((room) => room.kind === 'Opening')
    ? 'opening'
    : 'starting';

  if (topology === null) {
    return (
      <SemanticFindingsScope findings={evaluation?.findings ?? []}>
        <section className="biome-editor" {...(embedded ? {} : { 'aria-labelledby': titleId })}>
          <header className="panel-heading">
            {embedded ? null : (
              <div>
                <p className="eyebrow">
                  {routeKey} · {plan.biomeKey}
                </p>
                <h2 id={titleId}>{biomeLabel}</h2>
              </div>
            )}
            <div className="panel-heading-actions">
              <SemanticOwnerMarker address={biome} />
              <StatusBadge status={presentBiomeStatus(evaluation)} />
            </div>
          </header>

          <div className="empty-topology">
            <div>
              <h3>
                Choose {authoredStartKind === 'opening' ? 'an' : 'a'} {authoredStartKind} room
              </h3>
              <p>
                {biomeLabel} is configured for this project, but no authored topology exists yet.
              </p>
            </div>
            <div className="start-room-form">
              <RoomSelector
                idPrefix={startRoomId}
                interactions={interactions}
                label={`${authoredStartKind === 'opening' ? 'Opening' : 'Starting'} room`}
                onSelect={(gameName) => {
                  dispatch(
                    authoredProjectCommandDispatched({
                      kind: 'CreateStart',
                      biome,
                      occurrenceId: allocateOccurrenceId(),
                      gameName,
                    }),
                  );
                }}
                owner={biome}
                placeholder={`Select ${authoredStartKind === 'opening' ? 'an opening' : 'a room'}`}
              />
            </div>
          </div>
        </section>
      </SemanticFindingsScope>
    );
  }

  const start = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === topology.startOccurrenceId,
  );
  if (start === undefined) {
    throw new Error(`${biomeLabel} start occurrence ${topology.startOccurrenceId} is missing`);
  }
  const startRoom = startDeclaration(catalog, start.gameName);
  const startAddress = createOccurrenceAddress(biome, start.occurrenceId);

  return (
    <SemanticFindingsScope findings={evaluation?.findings ?? []}>
      <section className="biome-editor" {...(embedded ? {} : { 'aria-labelledby': titleId })}>
        <header className="panel-heading">
          {embedded ? null : (
            <div>
              <p className="eyebrow">
                {routeKey} · {plan.biomeKey}
              </p>
              <h2 id={titleId}>{biomeLabel}</h2>
            </div>
          )}
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={biome} />
            <StatusBadge status={presentBiomeStatus(evaluation)} />
            <button
              className="danger-action"
              onClick={() => {
                if (!globalThis.confirm(`Clear all authored ${biomeLabel} rooms and rewards?`)) {
                  return;
                }
                dispatch(authoredProjectCommandDispatched({ kind: 'ClearTopology', biome }));
              }}
              type="button"
            >
              Clear {biomeLabel}
            </button>
          </div>
        </header>

        {(focusedNodeKey === undefined || focusedNodeKey === semanticAddressKey(startAddress)) && (
          <article className="room-card">
            <div className="room-card-heading">
              <div>
                <p className="card-kicker">Starting room</p>
                <h3>{startRoom.kind}</h3>
              </div>
              <span className="room-kind">{startRoom.kind}</span>
              <SemanticOwnerMarker address={startAddress} />
            </div>
            <RoomSelector
              idPrefix={`${startRoomId}-authored`}
              interactions={interactions}
              label="Room"
              onSelect={(gameName) => {
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'ReplaceOccurrenceRoom',
                    occurrence: startAddress,
                    gameName,
                  }),
                );
              }}
              owner={startAddress}
              placeholder="Select a room"
            />
            <RoomStateEditor
              biome={biome}
              catalog={catalog}
              entryActive={true}
              interactions={interactions}
              occurrence={start}
            />
          </article>
        )}

        <LinearTopologyEditor
          biome={biome}
          catalog={catalog}
          evaluation={evaluation}
          {...(focusedNodeKey === undefined ? {} : { focusedNodeKey })}
          interactions={interactions}
          plan={plan}
          topology={topology}
        />
      </section>
    </SemanticFindingsScope>
  );
}

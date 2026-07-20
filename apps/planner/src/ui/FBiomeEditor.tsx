import type {
  Catalog,
  FProjectEvaluation,
  LinearBiomePlan,
  RoomDeclaration,
} from '@run-planner/core';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/core';
import { useState } from 'react';

import { allocateOccurrenceId } from '../application/occurrenceIds';
import { presentBiomeStatus } from '../application/evaluationProjection';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { useAppDispatch } from '../application/store';
import { FTopologyEditor } from './FTopologyEditor';
import { SemanticOwnerMarker, StatusBadge } from './EvaluationFeedback';
import { RoomStateEditor } from './RoomStateEditor';

interface FBiomeEditorProps {
  readonly catalog: Catalog;
  readonly evaluation: FProjectEvaluation;
  readonly plan: LinearBiomePlan;
  readonly routeKey: string;
}

function openingRooms(catalog: Catalog, biomeKey: string): readonly RoomDeclaration[] {
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
      throw new Error(`${biomeKey} opening ${gameName} is missing`);
    }
    return room;
  });
}

export function FBiomeEditor({ catalog, evaluation, plan, routeKey }: FBiomeEditorProps) {
  const dispatch = useAppDispatch();
  const [pendingOpening, setPendingOpening] = useState('');
  const options = openingRooms(catalog, plan.biomeKey);
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const topology = plan.topology;

  if (topology === null) {
    return (
      <section className="biome-editor" aria-labelledby="f-biome-title">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">{routeKey} · F</p>
            <h2 id="f-biome-title">Erebus</h2>
          </div>
          <div className="panel-heading-actions">
            <SemanticOwnerMarker address={biome} />
            <StatusBadge status={presentBiomeStatus(evaluation)} />
          </div>
        </header>

        <div className="empty-topology">
          <div>
            <h3>Choose an opening room</h3>
            <p>Erebus is configured for this project, but no authored topology exists yet.</p>
          </div>
          <div className="start-room-form">
            <label htmlFor="f-opening-room">Opening room</label>
            <select
              id="f-opening-room"
              onChange={(event) => setPendingOpening(event.target.value)}
              value={pendingOpening}
            >
              <option value="">Select an opening</option>
              {options.map((room) => (
                <option key={room.gameName} value={room.gameName}>
                  {room.label}
                </option>
              ))}
            </select>
            <button
              className="primary-action"
              disabled={pendingOpening === ''}
              onClick={() => {
                if (pendingOpening === '') {
                  return;
                }
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'CreateStart',
                    biome,
                    occurrenceId: allocateOccurrenceId(),
                    gameName: pendingOpening,
                  }),
                );
                setPendingOpening('');
              }}
              type="button"
            >
              Start Erebus
            </button>
          </div>
        </div>
      </section>
    );
  }

  const start = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === topology.startOccurrenceId,
  );
  if (start === undefined) {
    throw new Error(`Erebus start occurrence ${topology.startOccurrenceId} is missing`);
  }

  return (
    <section className="biome-editor" aria-labelledby="f-biome-title">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">{routeKey} · F</p>
          <h2 id="f-biome-title">Erebus</h2>
        </div>
        <div className="panel-heading-actions">
          <SemanticOwnerMarker address={biome} />
          <StatusBadge status={presentBiomeStatus(evaluation)} />
          <button
            className="danger-action"
            onClick={() => {
              if (!globalThis.confirm('Clear all authored Erebus rooms and rewards?')) {
                return;
              }
              dispatch(authoredProjectCommandDispatched({ kind: 'ClearTopology', biome }));
            }}
            type="button"
          >
            Clear Erebus
          </button>
        </div>
      </header>

      <article className="room-card">
        <div className="room-card-heading">
          <div>
            <p className="card-kicker">Starting room</p>
            <h3>Opening</h3>
          </div>
          <span className="room-kind">Opening</span>
          <SemanticOwnerMarker address={createOccurrenceAddress(biome, start.occurrenceId)} />
        </div>
        <label htmlFor="f-authored-opening">Room</label>
        <select
          id="f-authored-opening"
          onChange={(event) => {
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceOccurrenceRoom',
                occurrence: createOccurrenceAddress(biome, start.occurrenceId),
                gameName: event.target.value,
              }),
            );
          }}
          value={start.gameName}
        >
          {options.map((room) => (
            <option key={room.gameName} value={room.gameName}>
              {room.label}
            </option>
          ))}
        </select>
        <RoomStateEditor biome={biome} catalog={catalog} occurrence={start} />
      </article>

      <FTopologyEditor biome={biome} catalog={catalog} topology={topology} />
    </section>
  );
}

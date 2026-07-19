import type { Catalog, LinearBiomePlan, RoomDeclaration } from '@run-planner/core';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/core';
import { useState } from 'react';

import { authoredProjectCommandDispatched } from '../application/authoredProjectSlice';
import { allocateOccurrenceId } from '../application/occurrenceIds';
import { useAppDispatch } from '../application/store';
import { FTopologyEditor } from './FTopologyEditor';
import { RoomStateEditor } from './RoomStateEditor';

interface FBiomeEditorProps {
  readonly catalog: Catalog;
  readonly plan: LinearBiomePlan;
}

function openingRooms(catalog: Catalog, biomeStepKey: string): readonly RoomDeclaration[] {
  const layout = catalog.biomeLayouts.byKey[biomeStepKey];
  if (layout === undefined) {
    throw new Error(`${biomeStepKey} layout is missing`);
  }
  return layout.start.roomGameNames.map((gameName) => {
    const room = catalog.rooms.byKey[gameName];
    if (room === undefined) {
      throw new Error(`${biomeStepKey} opening ${gameName} is missing`);
    }
    return room;
  });
}

export function FBiomeEditor({ catalog, plan }: FBiomeEditorProps) {
  const dispatch = useAppDispatch();
  const [pendingOpening, setPendingOpening] = useState('');
  const options = openingRooms(catalog, plan.biomeStepKey);
  const biome = createBiomeAddress('Underworld', plan.biomeStepKey);
  const topology = plan.topology;

  if (topology === null) {
    return (
      <section className="biome-editor" aria-labelledby="f-biome-title">
        <header className="panel-heading">
          <div>
            <p className="eyebrow">Underworld · F</p>
            <h2 id="f-biome-title">Erebus</h2>
          </div>
          <span className="neutral-status">Not started</span>
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
          <p className="eyebrow">Underworld · F</p>
          <h2 id="f-biome-title">Erebus</h2>
        </div>
        <div className="panel-heading-actions">
          <span className="neutral-status">Authored</span>
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

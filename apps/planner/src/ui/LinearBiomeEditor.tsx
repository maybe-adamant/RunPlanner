import type {
  BiomeProjectEvaluation,
  Catalog,
  LinearBiomePlan,
  RoomDeclaration,
} from '@run-planner/core';
import { createBiomeAddress, createOccurrenceAddress } from '@run-planner/core';
import { useState } from 'react';

import {
  presentCandidateLabel,
  type CandidateProjectionService,
} from '../application/candidateProjection';
import { allocateOccurrenceId } from '../application/occurrenceIds';
import { presentBiomeStatus } from '../application/evaluationProjection';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import { selectPresentProject, useAppDispatch, useAppSelector } from '../application/store';
import { candidateSelectState } from './candidatePresentation';
import { LinearTopologyEditor } from './LinearTopologyEditor';
import { SemanticOwnerMarker, StatusBadge } from './EvaluationFeedback';
import { RoomStateEditor } from './RoomStateEditor';

interface LinearBiomeEditorProps {
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly evaluation: BiomeProjectEvaluation | undefined;
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
  candidateProjection,
  catalog,
  evaluation,
  plan,
  routeKey,
}: LinearBiomeEditorProps) {
  const dispatch = useAppDispatch();
  const project = useAppSelector(selectPresentProject);
  const [pendingStart, setPendingStart] = useState('');
  const options = startRooms(catalog, plan.biomeKey);
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
  const authoredStartKind = options.every((room) => room.kind === 'Opening')
    ? 'opening'
    : 'starting';
  const biome = createBiomeAddress(routeKey, plan.biomeKey);
  const topology = plan.topology;

  if (topology === null) {
    const projectedOptions = candidateProjection.startRooms(project, biome, options);
    return (
      <section className="biome-editor" aria-labelledby={titleId}>
        <header className="panel-heading">
          <div>
            <p className="eyebrow">
              {routeKey} · {plan.biomeKey}
            </p>
            <h2 id={titleId}>{biomeLabel}</h2>
          </div>
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
            <p>{biomeLabel} is configured for this project, but no authored topology exists yet.</p>
          </div>
          <div className="start-room-form">
            <label htmlFor={startRoomId}>
              {authoredStartKind === 'opening' ? 'Opening' : 'Starting'} room
            </label>
            <select
              id={startRoomId}
              onChange={(event) => setPendingStart(event.target.value)}
              value={pendingStart}
            >
              <option value="">
                Select {authoredStartKind === 'opening' ? 'an opening' : 'a room'}
              </option>
              {projectedOptions.map((option) => (
                <option
                  key={option.value.gameName}
                  value={option.value.gameName}
                  {...candidateSelectState(option)}
                >
                  {presentCandidateLabel(option.value.label, option)}
                </option>
              ))}
            </select>
            <button
              className="primary-action"
              disabled={pendingStart === ''}
              onClick={() => {
                if (pendingStart === '') {
                  return;
                }
                dispatch(
                  authoredProjectCommandDispatched({
                    kind: 'CreateStart',
                    biome,
                    occurrenceId: allocateOccurrenceId(),
                    gameName: pendingStart,
                  }),
                );
                setPendingStart('');
              }}
              type="button"
            >
              Start {biomeLabel}
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
    throw new Error(`${biomeLabel} start occurrence ${topology.startOccurrenceId} is missing`);
  }
  const startRoom = startDeclaration(catalog, start.gameName);
  const startAddress = createOccurrenceAddress(biome, start.occurrenceId);
  const projectedOptions = candidateProjection.startRooms(project, startAddress, options);
  const selectedStart = projectedOptions.find((option) => option.value.gameName === start.gameName);

  return (
    <section className="biome-editor" aria-labelledby={titleId}>
      <header className="panel-heading">
        <div>
          <p className="eyebrow">
            {routeKey} · {plan.biomeKey}
          </p>
          <h2 id={titleId}>{biomeLabel}</h2>
        </div>
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

      <article className="room-card">
        <div className="room-card-heading">
          <div>
            <p className="card-kicker">Starting room</p>
            <h3>{startRoom.kind}</h3>
          </div>
          <span className="room-kind">{startRoom.kind}</span>
          <SemanticOwnerMarker address={startAddress} />
        </div>
        <label htmlFor={`${startRoomId}-authored`}>Room</label>
        <select
          {...candidateSelectState(selectedStart)}
          id={`${startRoomId}-authored`}
          onChange={(event) => {
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ReplaceOccurrenceRoom',
                occurrence: startAddress,
                gameName: event.target.value,
              }),
            );
          }}
          value={start.gameName}
        >
          {projectedOptions.map((option) => (
            <option
              key={option.value.gameName}
              value={option.value.gameName}
              {...candidateSelectState(option)}
            >
              {presentCandidateLabel(option.value.label, option)}
            </option>
          ))}
        </select>
        <RoomStateEditor
          biome={biome}
          candidateProjection={candidateProjection}
          catalog={catalog}
          occurrence={start}
        />
      </article>

      <LinearTopologyEditor
        biome={biome}
        candidateProjection={candidateProjection}
        catalog={catalog}
        topology={topology}
      />
    </section>
  );
}

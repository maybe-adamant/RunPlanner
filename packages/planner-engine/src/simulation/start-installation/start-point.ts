import { semanticAddressKey } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ProjectBiomeEvaluation, ProjectEvaluation } from '../evaluation/evaluation-products';
import type { HistoryEvent } from '../history';
import { beginBiomeSimulationState } from '../rewards/branch-lifecycle';
import type { StartInstallationResult, StartPoint, StartRoomHistoryRecord } from './model';
import { projectStartInstallation } from './projection';

function unavailable(
  reason: Extract<StartInstallationResult, { availability: 'unavailable' }>['reason'],
): StartInstallationResult {
  return Object.freeze({ availability: 'unavailable', reason: Object.freeze(reason) });
}

function historyEvents(biome: ProjectBiomeEvaluation | undefined): readonly HistoryEvent[] {
  return biome !== undefined && 'history' in biome ? biome.history.events : [];
}

/**
 * One stub record per room-history ordinal advance through `throughSequence`,
 * in native order, each carrying its room's declared `NextRoomSet`.
 */
function stubRoomHistory(
  catalog: Catalog,
  events: readonly HistoryEvent[],
  throughSequence: number,
): readonly StartRoomHistoryRecord[] {
  const names = new Map<string, string>();
  const records: StartRoomHistoryRecord[] = [];
  for (const event of events) {
    if (event.sequence > throughSequence) break;
    if (event.kind === 'roomCreated') {
      names.set(semanticAddressKey(event.origin), event.gameName);
      continue;
    }
    const delta =
      event.kind === 'roomCountersAdvanced' || event.kind === 'roomRestored'
        ? event.roomHistoryOrdinalDelta
        : 0;
    if (delta === 0) continue;
    const key = semanticAddressKey(event.origin);
    const gameName = names.get(key);
    if (gameName === undefined) throw new Error(`${key} advances room history before creation`);
    const room = catalog.rooms.byKey[gameName];
    if (room === undefined) throw new Error(`${gameName} has no room declaration`);
    const nextRoomSet = room.nextRoomSet;
    for (let count = 0; count < delta; count += 1)
      records.push(Object.freeze({ gameName, nextRoomSet }));
  }
  return Object.freeze(records);
}

/**
 * The start installation at a biome's Opening or Preboss. An Opening installs
 * its predecessor's terminal state, before the native Intro's own biome start;
 * a Preboss installs the state its preparation received.
 */
export function startInstallationAt(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  startPoint: StartPoint,
): StartInstallationResult {
  const { itineraryBiomeKeys } = project.route;
  const index = itineraryBiomeKeys.indexOf(startPoint.biomeKey);
  if (index < 0) return unavailable({ kind: 'notOnItinerary' });
  if (startPoint.kind === 'opening' && index === 0) return unavailable({ kind: 'routeStart' });
  const biomeFor = (biomeKey: string) =>
    evaluation.route.biomes.find((biome) => biome.biomeKey === biomeKey);
  const start = biomeFor(startPoint.biomeKey);
  const priorEvents = itineraryBiomeKeys
    .slice(0, index)
    .flatMap((biomeKey) => historyEvents(biomeFor(biomeKey)));
  if (startPoint.kind === 'opening') {
    const predecessor = biomeFor(itineraryBiomeKeys[index - 1]!);
    const entry = historyEvents(start).find(
      (event) => event.kind === 'roomCreated' && event.source === 'biomeEntry',
    );
    if (
      predecessor?.authoring !== 'complete' ||
      predecessor.validity !== 'valid' ||
      entry?.kind !== 'roomCreated'
    )
      return unavailable({ kind: 'notReached' });
    // The native Intro resets the biome records before anything reads them.
    const states = predecessor.rewards.branches.map((branch) =>
      beginBiomeSimulationState(branch.state),
    );
    return projectStartInstallation(catalog, {
      startPoint,
      startRoomGameName: entry.gameName,
      states,
      roomHistory: stubRoomHistory(
        catalog,
        priorEvents,
        predecessor.history.afterTransition.sequence,
      ),
      visitedBiomeKeys: Object.freeze(itineraryBiomeKeys.slice(0, index)),
    });
  }
  const capture =
    start !== undefined && 'rewards' in start ? start.rewards.prebossStartState : undefined;
  const sequence = capture?.states[0]?.reached.historyView.sequence;
  if (capture === undefined || sequence === undefined) return unavailable({ kind: 'notReached' });
  return projectStartInstallation(catalog, {
    startPoint,
    startOccurrence: capture.owner,
    startRoomGameName: capture.gameName,
    states: capture.states,
    roomHistory: stubRoomHistory(catalog, [...priorEvents, ...historyEvents(start)], sequence),
    visitedBiomeKeys: Object.freeze(itineraryBiomeKeys.slice(0, index + 1)),
  });
}

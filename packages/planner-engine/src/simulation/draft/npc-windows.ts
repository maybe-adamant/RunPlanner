import type { Catalog, EncounterDefinition } from '../../catalog-schema';
import type { RequirementExpression, RoomStructuralTag } from '../../requirements/model';
import type { ProjectEvaluationAssembly } from '../evaluation/evaluation-products';
import { routeRoomDeclaration } from '../../authored-project/route-profile';
import { roomEncounterDefinitions } from './world';

/** The host conditions a field NPC encounter's requirements declare, read generically. */
export interface DraftNpcHostConditions {
  readonly encounterKey: string;
  readonly routeAllowed: boolean;
  readonly excludedRewardTypes: readonly string[];
  readonly requiredTags: readonly RoomStructuralTag[];
  readonly minimums: readonly {
    readonly axis: 'biomeDepthCache' | 'biomeEncounterDepth';
    readonly min: number;
  }[];
  /** Encounter keys whose record anywhere on the route bars this encounter. */
  readonly onceKeys: readonly string[];
  /** Encounter keys barred within the previous `roomWindow` rooms. */
  readonly gaps: readonly {
    readonly encounterKeys: readonly string[];
    readonly roomWindow: number;
  }[];
}

/** Reads an `all` of known leaves; undefined for any shape the draft cannot steer toward. */
export function draftNpcHostConditions(
  definition: EncounterDefinition,
  routeKey: string,
): DraftNpcHostConditions | undefined {
  let routeAllowed = true;
  const excludedRewardTypes: string[] = [];
  const requiredTags: RoomStructuralTag[] = [];
  const minimums: DraftNpcHostConditions['minimums'][number][] = [];
  const onceKeys: string[] = [];
  const gaps: DraftNpcHostConditions['gaps'][number][] = [];
  const read = (requirement: RequirementExpression): boolean => {
    switch (requirement.kind) {
      case 'all':
        return requirement.requirements.every(read);
      case 'not':
        if (requirement.requirement.kind !== 'routeKeyEquals') return false;
        routeAllowed &&= requirement.requirement.routeKey !== routeKey;
        return true;
      case 'routeKeyEquals':
        routeAllowed &&= requirement.routeKey === routeKey;
        return true;
      case 'counterRange':
        if (
          (requirement.axis !== 'biomeDepthCache' && requirement.axis !== 'biomeEncounterDepth') ||
          requirement.range.max !== undefined
        )
          return false;
        minimums.push({ axis: requirement.axis, min: requirement.range.min ?? 0 });
        return true;
      case 'currentRoomRewardExcludes':
        excludedRewardTypes.push(...requirement.rewardTypes);
        return true;
      case 'currentRoomStructuralTagsInclude':
        requiredTags.push(...requirement.tags);
        return true;
      case 'encounterKeyCount':
        if (requirement.scope !== 'route' || requirement.range.max !== 0) return false;
        onceKeys.push(...requirement.encounterKeys);
        return true;
      case 'previousRoomEncounterKeyCount':
        if (requirement.range.max !== 0) return false;
        gaps.push({ encounterKeys: requirement.encounterKeys, roomWindow: requirement.roomWindow });
        return true;
      default:
        return false;
    }
  };
  if (definition.requirements !== undefined && !read(definition.requirements)) return undefined;
  return Object.freeze({
    encounterKey: definition.key,
    routeAllowed,
    excludedRewardTypes: Object.freeze(excludedRewardTypes),
    requiredTags: Object.freeze(requiredTags),
    minimums: Object.freeze(minimums),
    onceKeys: Object.freeze(onceKeys),
    gaps: Object.freeze(gaps),
  });
}

/** One selected field NPC's steerable encounter in a biome, with the rooms that can host it. */
export interface DraftNpcHost {
  readonly npcKey: string;
  readonly conditions: DraftNpcHostConditions;
  readonly hostRooms: ReadonlySet<string>;
}

/** Selected field NPC encounters of each biome the route allows and the reader can steer. */
export function draftNpcHosts(
  catalog: Catalog,
  routeKey: string,
  fieldNpcsByBiome: Readonly<Record<string, readonly string[]>>,
): ReadonlyMap<string, readonly DraftNpcHost[]> {
  const byBiome = new Map<string, DraftNpcHost[]>();
  for (const [biomeKey, npcKeys] of Object.entries(fieldNpcsByBiome)) {
    const hosts = new Map<
      string,
      { npcKey: string; conditions: DraftNpcHostConditions; rooms: Set<string> }
    >();
    for (const declared of catalog.rooms.values) {
      const room = routeRoomDeclaration(declared, routeKey);
      if (room.roomSetKey !== biomeKey) continue;
      for (const definition of roomEncounterDefinitions(catalog, room.encounterSlotBindings)) {
        const npcKey = definition.npcPresentationKey;
        if (
          definition.kind !== 'combat' ||
          npcKey === undefined ||
          !npcKeys.includes(npcKey) ||
          !catalog.fieldNpcEncounterKeys.includes(definition.key)
        )
          continue;
        let host = hosts.get(definition.key);
        if (host === undefined) {
          const conditions = draftNpcHostConditions(definition, routeKey);
          if (conditions === undefined || !conditions.routeAllowed) continue;
          host = { npcKey, conditions, rooms: new Set() };
          hosts.set(definition.key, host);
        }
        if (host.conditions.requiredTags.every((tag) => room.structuralTags.includes(tag)))
          host.rooms.add(room.gameName);
      }
    }
    byBiome.set(
      biomeKey,
      [...hosts.values()].map((host) =>
        Object.freeze({ npcKey: host.npcKey, conditions: host.conditions, hostRooms: host.rooms }),
      ),
    );
  }
  return byBiome;
}

/** Whether a host's route-once, gap and counter conditions hold for the biome's next entered room. */
export function draftNpcWindowOpen(
  assembly: ProjectEvaluationAssembly,
  biomeKey: string,
  conditions: DraftNpcHostConditions,
): boolean {
  const biome = assembly.evaluation.route.biomes.find((entry) => entry.biomeKey === biomeKey);
  if (biome === undefined || !('history' in biome)) return false;
  const ledgers = biome.history.ledgers;
  if (ledgers.encounterRecords.some((record) => conditions.onceKeys.includes(record.encounterKey)))
    return false;
  for (const gap of conditions.gaps) {
    const last = ledgers.encounterRecords.findLast((record) =>
      gap.encounterKeys.includes(record.encounterKey),
    );
    if (
      last !== undefined &&
      ledgers.roomAppearances.filter((appearance) => appearance.sequence > last.sequence).length <
        gap.roomWindow
    )
      return false;
  }
  // Leaving the current room advances each counter once before the next room's preparation.
  return conditions.minimums.every(({ axis, min }) => (ledgers.counters[axis] ?? 0) + 1 >= min);
}

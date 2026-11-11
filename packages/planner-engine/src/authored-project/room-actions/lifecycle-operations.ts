import type {
  Catalog,
  EncounterDefinition,
  EncounterEnvelopeKind,
  RoomDeclaration,
  RoomLifecycleOperation,
  RoomLifecycleProfile,
} from '../../catalog-schema';
import type { ProducerLifecyclePointKey } from '../../reward-kernel/model';

const composed = new WeakMap<
  Catalog,
  WeakMap<RoomDeclaration, Map<RoomLifecycleProfile, readonly RoomLifecycleOperation[]>>
>();

function boundEncounters(
  catalog: Catalog,
  declaration: RoomDeclaration,
): readonly EncounterDefinition[] {
  return declaration.encounterSlotBindings.flatMap((binding) =>
    (binding.kind === 'set'
      ? (catalog.encounterSets.byKey[binding.encounterSetKey]?.encounterDefinitionKeys ?? [])
      : [
          binding.encounterDefinitionKey,
          ...(binding.rivalsEncounterDefinitionKey === undefined
            ? []
            : [binding.rivalsEncounterDefinitionKey]),
          ...(binding.shadowEncounterDefinitionKey === undefined
            ? []
            : [binding.shadowEncounterDefinitionKey]),
        ]
    ).flatMap((key) => catalog.encounterDefinitions.byKey[key] ?? []),
  );
}

/** The producer point a gate role's pickup is taken at, in the room's reward lifecycles. */
function gateRolePoints(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  role: string,
  gameName: string,
): readonly ProducerLifecyclePointKey[] {
  if (profile.producer.kind === 'none') return [];
  const points = new Set<ProducerLifecyclePointKey>();
  for (const key of profile.producer.lifecycleProfileKeys)
    for (const reward of catalog.rewards.producerLifecycles.byKey[key]?.rewardTypes.values ?? [])
      for (const binding of reward.acquisitionLifecycle)
        if (binding.role === role) points.add(binding.lifecyclePoint);
  if (points.size !== 1)
    throw new Error(`${gameName} gate role ${role} has no single ${profile.key} producer point`);
  return [...points];
}

function encounterOperations(kind: EncounterEnvelopeKind): readonly RoomLifecycleOperation[] {
  switch (kind) {
    case 'none':
      return [];
    case 'single':
      return [
        {
          kind: 'startEncounter',
          encounter: { kind: 'only' },
          effects: ['recordEncounterStart', 'advanceEncounterDepth'],
        },
        {
          kind: 'completeEncounter',
          encounter: { kind: 'only' },
          effects: ['recordEncounterCompletion'],
        },
      ];
    case 'sequential':
    case 'playerActivatedCages':
      return [
        {
          kind: 'runEncounterSequence',
          effects: ['recordEncounterStart', 'advanceEncounterDepth', 'recordEncounterCompletion'],
        },
      ];
    case 'wheelPhases':
      // Each phase rolls its wheels as it sets up, then fights.
      return [
        {
          kind: 'runRewardEncounterSequence',
          effects: [
            'recordPhaseOfferPoint',
            'recordEncounterStart',
            'advanceEncounterDepth',
            'recordEncounterCompletion',
          ],
        },
      ];
  }
}

function compose(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
): readonly RoomLifecycleOperation[] {
  const envelope = catalog.encounterEnvelopes.byKey[declaration.encounterEnvelopeKey];
  if (envelope === undefined)
    throw new Error(
      `${declaration.gameName} has unknown envelope ${declaration.encounterEnvelopeKey}`,
    );
  const points = profile.producer.kind === 'none' ? [] : profile.producer.points;
  const gatePoints = new Set(
    boundEncounters(catalog, declaration).flatMap((encounter) =>
      encounter.script.gate.kind === 'useItemRole'
        ? gateRolePoints(catalog, profile, encounter.script.gate.role, declaration.gameName)
        : [],
    ),
  );
  const advance = (point: ProducerLifecyclePointKey): RoomLifecycleOperation => ({
    kind: 'advanceProducer',
    point,
    effects: ['recordProducerPoint'],
  });
  const beforeCombat = points.filter((point) => point === 'beforeCombat' || gatePoints.has(point));
  const afterCombat = points.filter((point) => !beforeCombat.includes(point));
  const operations: RoomLifecycleOperation[] = [];
  profile.steps.forEach((step, index) => {
    if (step.kind === 'runEncounterScripts') {
      operations.push(...beforeCombat.map(advance), ...encounterOperations(envelope.kind));
      // The room reward's later points follow combat and any pylon completion.
      if (profile.steps[index + 1]?.kind !== 'completeRequiredObjects')
        operations.push(...afterCombat.map(advance));
      return;
    }
    operations.push(step);
    if (step.kind === 'completeRequiredObjects') operations.push(...afterCombat.map(advance));
  });
  return Object.freeze(operations.map((operation) => Object.freeze(operation)));
}

/**
 * The room's lifecycle operations: the profile's room-level steps with its
 * envelope's encounters run in place of its script step, each producer point
 * before or after combat by the bound encounters' gates.
 */
export function roomLifecycleOperations(
  catalog: Catalog,
  profile: RoomLifecycleProfile,
  declaration: RoomDeclaration,
): readonly RoomLifecycleOperation[] {
  let byDeclaration = composed.get(catalog);
  if (byDeclaration === undefined) {
    byDeclaration = new WeakMap();
    composed.set(catalog, byDeclaration);
  }
  let byProfile = byDeclaration.get(declaration);
  if (byProfile === undefined) {
    byProfile = new Map();
    byDeclaration.set(declaration, byProfile);
  }
  const cached = byProfile.get(profile);
  if (cached !== undefined) return cached;
  const operations = compose(catalog, profile, declaration);
  byProfile.set(profile, operations);
  return operations;
}

import type { Catalog, EncounterEnvelopeSlot, RoomDeclaration } from '../../catalog-schema';
import type {
  AuthoredEncounterCustomization,
  RoomEncounterState,
} from '../../authored-project/model';
import {
  createEncounterPhaseAddress,
  type EncounterPhaseAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import {
  encounterAuthoringProfiles,
  encounterBindingsBySlot,
  encounterEnvelopeSlots,
  encounterSetForBinding,
} from '../../authored-project/room-state/encounter-envelope';

/**
 * The authored encounter surface for one active room phase. Set-backed phases
 * expose their declaration choices; fixed phases appear only when their
 * declaration owns an encounter trait offer. Candidate eligibility is
 * deliberately absent: this is the declaration and persisted-selection
 * domain used to keep controls present while evaluation is unavailable.
 */
export interface EncounterPhaseAuthoringDomain {
  readonly origin: EncounterPhaseAddress;
  readonly slotKey: string;
  readonly selectedEncounterKey: string;
  readonly selectedEncounterDefinitionKey?: string;
  readonly selectedEncounterKind: import('../../catalog-schema').EncounterPhaseKind;
  readonly declaredEncounterKeys: readonly string[];
  readonly choices: readonly {
    readonly key: string;
    readonly label: string;
    readonly directEncounterDefinitionKey?: string;
  }[];
  readonly defaultEncounterKey: string;
  /** Concrete declaration domain for the current direct encounter identity. */
  readonly customization?: readonly {
    readonly key: string;
    readonly label: string;
    readonly selection: import('../../catalog-schema').EncounterCustomizationDecision['selection'];
    readonly value?: AuthoredEncounterCustomization;
    readonly valueSupported: boolean;
    readonly retainedChoiceLabels?: readonly { readonly key: string; readonly label: string }[];
  }[];
}

export type EncounterPhaseAuthoringOwner = EncounterPhaseAddress['owner'];

/**
 * Authored facts that control template-owned phase activation. These are
 * structural facts, not contextual candidate eligibility.
 */
export interface EncounterPhaseAuthoringRoomOptions {
  readonly shipEncounterCount?: 2 | 3;
  readonly fieldsCageRewardCount?: number;
  /** Include singleton phases so a consumer can project phase-local controls. */
  readonly includeFixedPhases?: boolean;
}

function templateSlotActive(
  room: RoomDeclaration,
  slot: EncounterEnvelopeSlot,
  options: EncounterPhaseAuthoringRoomOptions,
): boolean {
  if (slot.activation === 'always') return true;

  if (room.mode.kind === 'authored' && room.mode.templateKey === 'ShipCombat') {
    if (room.encounterEnvelopeKey !== 'ShipEncounter' || slot.key !== 'Combat2') {
      throw new Error(`${room.gameName}.${slot.key} is not a supported ShipCombat phase`);
    }
    if (options.shipEncounterCount === undefined) {
      throw new Error(`${room.gameName}.${slot.key} requires the authored encounter count`);
    }
    return options.shipEncounterCount === 3;
  }

  if (room.mode.kind === 'authored' && room.mode.templateKey === 'FieldsCombat') {
    if (room.encounterEnvelopeKey !== 'FieldsEncounter' || !slot.key.startsWith('Cage')) {
      throw new Error(`${room.gameName}.${slot.key} is not a supported FieldsCombat phase`);
    }
    if (options.fieldsCageRewardCount === undefined) {
      throw new Error(`${room.gameName}.${slot.key} requires the authored Fields cage count`);
    }
    const index = Number(slot.key.slice('Cage'.length));
    if (!Number.isInteger(index) || index <= 0) {
      throw new Error(`${room.gameName}.${slot.key} has no Fields cage ordinal`);
    }
    return index <= options.fieldsCageRewardCount;
  }

  throw new Error(`${room.gameName}.${slot.key} has unsupported template-controlled activation`);
}

/**
 * Resolves the authored encounter controls for one room occurrence or local
 * child. It consults only catalog membership, the persisted selection, and
 * explicit template activation facts; it never evaluates requirements.
 */
export function encounterPhaseAuthoringDomainForRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  room: RoomDeclaration,
  owner: EncounterPhaseAuthoringOwner,
  encounters: RoomEncounterState,
  options: EncounterPhaseAuthoringRoomOptions = {},
): readonly EncounterPhaseAuthoringDomain[] {
  const bindings = encounterBindingsBySlot(catalog, room, room.gameName);
  const slots = new Map(
    encounterEnvelopeSlots(catalog, room, room.gameName).map((slot) => [slot.key, slot]),
  );
  const domains: EncounterPhaseAuthoringDomain[] = [];
  for (const binding of bindings.values()) {
    if (
      binding.kind === 'fixed' &&
      options.includeFixedPhases !== true &&
      catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.traitOfferProducer ===
        undefined
    )
      continue;
    const slot = slots.get(binding.slotKey);
    if (slot === undefined || !templateSlotActive(room, slot, options)) continue;
    const selectedEncounterKey =
      binding.kind === 'fixed'
        ? binding.encounterDefinitionKey
        : encounters.encounterKeyByPhase[binding.slotKey];
    if (selectedEncounterKey === undefined) {
      throw new Error(`${room.gameName}.${binding.slotKey} has no authored encounter selection`);
    }
    const profiles =
      binding.kind === 'fixed'
        ? []
        : encounterAuthoringProfiles(encounterSetForBinding(catalog, binding, room.gameName));
    const declaredEncounterKeys =
      binding.kind === 'fixed'
        ? [binding.encounterDefinitionKey]
        : profiles.map((profile) => profile.key);
    if (!declaredEncounterKeys.includes(selectedEncounterKey)) {
      throw new Error(
        `${room.gameName}.${binding.slotKey} selected ${selectedEncounterKey} outside its declaration`,
      );
    }
    const selectedEncounterDefinitionKey =
      binding.kind === 'fixed'
        ? binding.encounterDefinitionKey
        : profiles.find((candidate) => candidate.key === selectedEncounterKey)!.resolution.kind ===
            'direct'
          ? (
              profiles.find((candidate) => candidate.key === selectedEncounterKey)!
                .resolution as Extract<
                (typeof profiles)[number]['resolution'],
                { readonly kind: 'direct' }
              >
            ).encounterDefinitionKey
          : undefined;
    const definition =
      selectedEncounterDefinitionKey === undefined
        ? undefined
        : catalog.encounterDefinitions.byKey[selectedEncounterDefinitionKey];
    const customization =
      definition?.customization === undefined
        ? undefined
        : Object.freeze(
            definition.customization.map((decision) => {
              const value = encounters.customizationByPhase?.[binding.slotKey]?.[decision.key];
              const valueSupported =
                value === undefined ||
                (value.kind === decision.selection.kind &&
                  (value.kind === 'single'
                    ? decision.selection.choices.some((choice) => choice.key === value.choiceKey)
                    : decision.selection.kind === 'orderedPrefix' &&
                      value.choiceKeys.length <= decision.selection.maximumLength &&
                      new Set(value.choiceKeys).size === value.choiceKeys.length &&
                      value.choiceKeys.every((choiceKey) =>
                        decision.selection.choices.some((choice) => choice.key === choiceKey),
                      )));
              const retainedChoiceLabels =
                value === undefined
                  ? []
                  : (value.kind === 'single' ? [value.choiceKey] : value.choiceKeys).flatMap(
                      (choiceKey) => {
                        const choice = catalog.encounterDefinitions.values
                          .flatMap((candidate) => candidate.customization ?? [])
                          .filter((candidate) => candidate.key === decision.key)
                          .flatMap((candidate) => candidate.selection.choices)
                          .find((candidate) => candidate.key === choiceKey);
                        return choice === undefined
                          ? []
                          : [Object.freeze({ key: choiceKey, label: choice.label })];
                      },
                    );
              return Object.freeze({
                ...decision,
                valueSupported,
                ...(value === undefined ? {} : { value }),
                ...(retainedChoiceLabels.length === 0 ? {} : { retainedChoiceLabels }),
              });
            }),
          );
    domains.push(
      Object.freeze({
        origin: createEncounterPhaseAddress(biome, owner, binding.slotKey),
        slotKey: binding.slotKey,
        selectedEncounterKey,
        ...(selectedEncounterDefinitionKey === undefined ? {} : { selectedEncounterDefinitionKey }),
        selectedEncounterKind:
          binding.kind === 'fixed'
            ? catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]!.kind
            : profiles.find((candidate) => candidate.key === selectedEncounterKey)!.kind,
        declaredEncounterKeys: Object.freeze([...declaredEncounterKeys]),
        choices: Object.freeze(
          binding.kind === 'fixed'
            ? [
                Object.freeze({
                  key: binding.encounterDefinitionKey,
                  label:
                    catalog.encounterDefinitions.byKey[binding.encounterDefinitionKey]?.label ??
                    binding.encounterDefinitionKey,
                  directEncounterDefinitionKey: binding.encounterDefinitionKey,
                }),
              ]
            : profiles.map((profile) =>
                Object.freeze({
                  key: profile.key,
                  label: profile.label,
                  ...(profile.resolution.kind === 'direct'
                    ? { directEncounterDefinitionKey: profile.resolution.encounterDefinitionKey }
                    : {}),
                }),
              ),
        ),
        defaultEncounterKey:
          binding.kind === 'fixed'
            ? binding.encounterDefinitionKey
            : encounterSetForBinding(catalog, binding, room.gameName).defaultAuthoringProfileKey,
        ...(customization === undefined ? {} : { customization }),
      }),
    );
  }
  return Object.freeze(domains);
}

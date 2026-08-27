import type { Catalog } from '../../catalog-schema';
import {
  traitGiverForAcquisitionRole,
  traitOfferSupportsExhaustion,
  traitOfferOption,
  optionIndex,
  normalizeAuthoredEchoLastRunBoon,
  normalizeAllTogetherResult,
  normalizeAuthoredChaosTraitOffer,
  normalizeAuthoredConcaveStoneResult,
  type AuthoredGorgonAthenaOffer,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
} from '../traits';
import {
  reconcileSelectedPickupProducerState,
  selectedPickupProducerForEntry,
} from '../pickup-producers';
import {
  createBiomeAddress,
  type AcquisitionEntryAddress,
  type TraitOfferAddress,
} from '../addresses';
import type { ProjectDocument, RoomOccurrence, AuthoredRewardState } from '../model';
import type { AuthoredLevelResolution } from '../traits';
import { selectedEncounterDefinitionKey } from '../room-state/encounter-envelope';
import { requireShipCombatWheels } from '../room-state/declaration';
import { incomingLevelEffectSource } from '../room-state/level-effects';
import { parseArtificerReplacementEntryKey } from '../artificer';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { sameOccurrenceValue } from './occurrence-leaf-value';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { TraitOfferCommand } from './types';
import type { LevelResolutionEffectSource } from '../../reward-kernel/level-effects';
import {
  authoredAcquisitionEntry,
  authoredAcquisitionEntryAtSite,
  replaceAuthoredAcquisitionEntry,
  replaceAuthoredAcquisitionEntryAtSite,
} from '../shop';

function commandTraitAddress(command: TraitOfferCommand): TraitOfferAddress {
  return command.trait;
}

function replaceTraitOfferValue(
  catalog: Catalog,
  existing: AuthoredTraitOffer | null,
  command: TraitOfferCommand,
): AuthoredTraitOffer | null {
  if (command.kind === 'ResetEncounterTraitOffer') return null;
  if (command.kind === 'ReplaceTraitOffer') return validateOffer(catalog, command.value, command);
  if (existing === null) failCommand(command, 'trait offer must be authored as one complete offer');
  if (command.kind === 'ReplaceTraitSelection')
    return Object.freeze({ ...existing, selectedOptionKey: command.selectedOptionKey });
  if (command.kind === 'ReplaceConcaveStoneResult') {
    if (existing.kind !== 'traits') failCommand(command, 'Concave Stone requires a trait offer');
    if (command.value === null) {
      const { concaveStoneResult: _result, ...withoutResult } = existing;
      void _result;
      return Object.freeze(withoutResult);
    }
    try {
      return Object.freeze({
        ...existing,
        concaveStoneResult: normalizeAuthoredConcaveStoneResult(
          command.value,
          existing.selectedOptionKey,
          existing.options,
        ),
      });
    } catch (error) {
      return failCommand(
        command,
        error instanceof Error ? error.message : 'invalid Concave Stone result',
      );
    }
  }
  if (command.kind === 'ReplaceGorgonAthenaOffer')
    failCommand(command, 'Gorgon Athena decisions require a Gorgon phase owner');
  return failCommand(command, 'unsupported trait-offer command');
}

function validateGorgonAthenaOffer(
  catalog: Catalog,
  value: AuthoredGorgonAthenaOffer,
  command: TraitOfferCommand,
): AuthoredGorgonAthenaOffer {
  const effect = catalog.keepsakes.values.find(
    (keepsake) => keepsake.effect?.kind === 'gorgonAmulet',
  )?.effect;
  const giver =
    effect?.kind === 'gorgonAmulet' ? catalog.traitGivers.byKey[effect.providerKey] : undefined;
  if (
    giver === undefined ||
    value.traitKeys.length !== 3 ||
    new Set(value.traitKeys).size !== 3 ||
    value.traitKeys.some((traitKey) => !giver.traitKeys.includes(traitKey))
  )
    failCommand(command, 'Gorgon Athena requires three distinct Athena trait identities');
  if (!['option1', 'option2', 'option3'].includes(value.selectedOptionKey))
    failCommand(command, 'selected option must be option1, option2, or option3');
  return Object.freeze({
    traitKeys: Object.freeze([...value.traitKeys]) as readonly [string, string, string],
    selectedOptionKey: value.selectedOptionKey,
  });
}

export interface LocatedTraitReward {
  readonly reward: AuthoredRewardState;
  readonly levelEffectSource: LevelResolutionEffectSource;
}

function requireAuthoredReward(
  reward: AuthoredRewardState | null | undefined,
  command: TraitOfferCommand,
  detail: string,
): AuthoredRewardState {
  if (reward === undefined || reward === null) failCommand(command, detail);
  return reward;
}

function pickupEntrySource(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  owner: AcquisitionEntryAddress,
  command: TraitOfferCommand,
): LocatedTraitReward {
  const entry = authoredAcquisitionEntryAtSite(occurrence, owner.site, owner.entryKey);
  if (entry === undefined || entry === null)
    failCommand(command, `missing or unresolved pickup entry ${owner.entryKey}`);
  if (occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined)
    return Object.freeze({
      reward: entry,
      levelEffectSource: {
        kind: 'shopProfile' as const,
        key: occurrence.state.shop.profileKey,
      },
    });
  if (parseArtificerReplacementEntryKey(owner.entryKey) !== undefined)
    return Object.freeze({
      reward: entry,
      levelEffectSource: { kind: 'producerLifecycle' as const, key: 'RoomReward' },
    });
  const producer = selectedPickupProducerForEntry(
    catalog,
    createBiomeAddress(owner.routeKey, owner.biomeKey),
    occurrence,
    owner.site.pointKey,
    owner.entryKey,
  );
  if (producer === undefined) failCommand(command, 'pickup entry has no unique selected producer');
  return Object.freeze({
    reward: entry,
    levelEffectSource: {
      kind: 'producerLifecycle' as const,
      key: producer.producerLifecycleKey,
    },
  });
}

function validateOffer(
  catalog: Catalog,
  value: AuthoredTraitOffer,
  command: TraitOfferCommand,
): AuthoredTraitOffer {
  const giver = catalog.traitGivers.byKey[value.giverKey];
  if (giver === undefined) failCommand(command, `unknown trait giver ${value.giverKey}`);
  if (value.kind === 'fallbackGold') {
    if (!traitOfferSupportsExhaustion(giver))
      failCommand(command, `Fallback Gold is not supported by ${value.giverKey}`);
    return Object.freeze({ kind: 'fallbackGold', giverKey: value.giverKey });
  }
  if (value.kind === 'chaos') {
    try {
      return normalizeAuthoredChaosTraitOffer(catalog, value);
    } catch (error) {
      return failCommand(command, error instanceof Error ? error.message : 'invalid Chaos pair');
    }
  }
  if (value.options.length < 1 || value.options.length > 3)
    failCommand(command, 'trait offers require one to three options');
  if (!traitOfferSupportsExhaustion(giver) && value.options.length !== 3)
    failCommand(command, 'this trait giver requires exactly three options');
  if (new Set(value.options.map((option) => option.traitKey)).size !== value.options.length)
    failCommand(command, 'trait option keys must be distinct');
  if (
    !['option1', 'option2', 'option3'].includes(value.selectedOptionKey) ||
    value.options[optionIndex(value.selectedOptionKey)] === undefined
  )
    failCommand(command, 'selected option must be option1, option2, or option3');
  for (const [index, option] of value.options.entries()) {
    const trait = catalog.traits.byKey[option.traitKey];
    if (trait === undefined || !giver.traitKeys.includes(option.traitKey))
      failCommand(
        command,
        `option${index + 1} ${option.traitKey} is not in giver ${value.giverKey}`,
      );
    if (
      option.persephoneLevelBonus !== undefined &&
      (!Number.isInteger(option.persephoneLevelBonus) ||
        option.persephoneLevelBonus < 0 ||
        option.persephoneLevelBonus > 8)
    )
      failCommand(
        command,
        `${option.traitKey} Persephone level bonus must be an integer from 0 to 8`,
      );
    if (trait.rarityDomain.kind === 'none') {
      if (option.rarity !== undefined)
        failCommand(command, `rarityless option ${option.traitKey} has no rarity`);
    } else if (
      option.rarity === undefined ||
      !trait.rarityDomain.equippedRarities.includes(option.rarity)
    ) {
      failCommand(command, `unsupported authored rarity for ${option.traitKey}`);
    }
    if (giver.rarityPolicy.kind === 'fixed' && option.rarity !== giver.rarityPolicy.rarity) {
      failCommand(command, `${option.traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`);
    }
    if (option.targetTraitKey !== undefined) {
      if (trait.targetedAcquisition === undefined)
        failCommand(command, `${option.traitKey} does not target another trait on acquisition`);
      if (catalog.traits.byKey[option.targetTraitKey] === undefined)
        failCommand(command, `unknown target trait ${option.targetTraitKey}`);
    }
    if (option.circeResolution !== undefined) {
      const expected =
        trait.selectedDisposition.kind === 'circe' ? trait.selectedDisposition.effect : undefined;
      if (expected === undefined || option.circeResolution.kind !== expected)
        failCommand(command, `${option.traitKey} has an incompatible Circe resolution`);
      if (option.circeResolution.kind === 'disableFear') {
        if (
          option.circeResolution.vowKey !== null &&
          catalog.fearVows.byKey[option.circeResolution.vowKey] === undefined
        )
          failCommand(command, `unknown Circe Vow ${option.circeResolution.vowKey}`);
      } else {
        const keys = option.circeResolution.arcanaKeys;
        if (
          new Set(keys).size !== keys.length ||
          keys.some((key) => catalog.arcanaCards.byKey[key] === undefined)
        )
          failCommand(command, `${option.traitKey} requires distinct known Arcana keys`);
      }
    }
    if ('echoPomTarget' in option) {
      if (
        trait.selectedDisposition.kind !== 'echo' ||
        trait.selectedDisposition.effect !== 'doubleLevel'
      )
        failCommand(command, `${option.traitKey} does not support an Echo Pom target`);
      if (
        option.echoPomTarget !== null &&
        (typeof option.echoPomTarget !== 'string' ||
          catalog.traits.byKey[option.echoPomTarget] === undefined)
      )
        failCommand(command, `unknown Echo Pom target ${String(option.echoPomTarget)}`);
    }
    if ('echoLastRunBoon' in option) {
      if (
        trait.selectedDisposition.kind !== 'echo' ||
        trait.selectedDisposition.effect !== 'lastRunBoon'
      )
        failCommand(command, `${option.traitKey} does not support Echo Boon Boon Boon outcomes`);
      try {
        normalizeAuthoredEchoLastRunBoon(catalog, option.echoLastRunBoon);
      } catch (error) {
        failCommand(
          command,
          error instanceof Error ? error.message : 'invalid Echo Boon Boon Boon outcomes',
        );
      }
    }
    if ('allTogetherResult' in option) {
      try {
        normalizeAllTogetherResult(catalog, option.traitKey, option.allTogetherResult);
      } catch (error) {
        failCommand(
          command,
          error instanceof Error ? error.message : 'invalid All Together result',
        );
      }
    }
  }
  if (
    value.rarificationActions !== undefined &&
    (!Array.isArray(value.rarificationActions) ||
      value.rarificationActions.some((key) => !['option1', 'option2', 'option3'].includes(key)))
  )
    failCommand(command, 'rarification actions must name trait offer option rows');
  if (value.concaveStoneResult !== undefined) {
    try {
      normalizeAuthoredConcaveStoneResult(
        value.concaveStoneResult,
        value.selectedOptionKey,
        value.options,
      );
    } catch (error) {
      failCommand(command, error instanceof Error ? error.message : 'invalid Concave Stone result');
    }
  }
  return Object.freeze({
    kind: 'traits',
    giverKey: value.giverKey,
    options: Object.freeze(
      value.options.map((option) => {
        const resolution = option.circeResolution;
        const echoLastRunBoon =
          'echoLastRunBoon' in option
            ? normalizeAuthoredEchoLastRunBoon(catalog, option.echoLastRunBoon)
            : undefined;
        const allTogetherResult =
          'allTogetherResult' in option
            ? normalizeAllTogetherResult(catalog, option.traitKey, option.allTogetherResult)
            : undefined;
        if (resolution === undefined)
          return Object.freeze({
            ...option,
            ...(echoLastRunBoon === undefined ? {} : { echoLastRunBoon }),
            ...(allTogetherResult === undefined ? {} : { allTogetherResult }),
          });
        if (resolution.kind === 'disableFear')
          return Object.freeze({
            ...option,
            circeResolution: Object.freeze({ kind: resolution.kind, vowKey: resolution.vowKey }),
          });
        return Object.freeze({
          ...option,
          circeResolution: Object.freeze({
            kind: resolution.kind,
            // Persist exact Arcana sets in declaration order, matching decode.
            arcanaKeys: Object.freeze(
              catalog.arcanaCards.values
                .filter((card) => resolution.arcanaKeys.includes(card.key))
                .map((card) => card.key),
            ),
          }),
        });
      }),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: value.selectedOptionKey,
    rarificationActions: Object.freeze([...(value.rarificationActions ?? [])]),
    ...(value.rejectedOptionKey === undefined
      ? {}
      : { rejectedOptionKey: value.rejectedOptionKey }),
    ...(value.concaveStoneResult === undefined
      ? {}
      : {
          concaveStoneResult: normalizeAuthoredConcaveStoneResult(
            value.concaveStoneResult,
            value.selectedOptionKey,
            value.options,
          ),
        }),
  });
}

export function updateLevelResolutionReward(
  reward: AuthoredRewardState,
  role: string,
  value: AuthoredLevelResolution,
): AuthoredRewardState {
  return Object.freeze({
    ...reward,
    levelResolutionsByAcquisitionRole: Object.freeze({
      ...(reward.levelResolutionsByAcquisitionRole ?? {}),
      [role]: value,
    }),
  });
}

function updateReward(
  reward: AuthoredRewardState,
  role: string,
  value: AuthoredTraitOffer,
): AuthoredRewardState {
  return Object.freeze({
    ...reward,
    traitOffersByAcquisitionRole: Object.freeze({
      ...reward.traitOffersByAcquisitionRole,
      [role]: value,
    }),
  });
}

export function locateTraitReward(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
): LocatedTraitReward | undefined {
  const trait = commandTraitAddress(command);
  const owner = trait.owner;
  switch (owner.kind) {
    case 'acquisitionEntry':
      return pickupEntrySource(catalog, located, occurrence, owner, command);
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'ephyraCombat': {
          const room = catalog.rooms.byKey[occurrence.gameName];
          const binding = room?.incomingReward;
          if (binding === undefined || binding.kind === 'none')
            failCommand(command, `${occurrence.gameName} has no incoming reward binding`);
          return Object.freeze({
            reward: requireAuthoredReward(
              state.reward,
              command,
              'cannot edit trait offer before reward authorship',
            ),
            levelEffectSource: {
              kind: 'producerLifecycle',
              key: binding.producerLifecycleKey,
            } as const,
          });
        }
        case 'anomaly':
        case 'freeReward': {
          const levelEffectSource = incomingLevelEffectSource(catalog, occurrence);
          if (levelEffectSource === undefined)
            failCommand(command, `${occurrence.gameName} has no declared incoming reward binding`);
          return Object.freeze({
            reward: requireAuthoredReward(
              state.reward,
              command,
              'cannot edit trait offer before reward authorship',
            ),
            levelEffectSource,
          });
        }
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const cageGroup = room?.localChildren.find((child) => child.key === owner.groupKey);
        const binding =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.reward
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.reward
              : undefined;
        const slotKeys =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.slotKeys
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.slotKeys
              : [];
        if (binding === undefined) {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward =
          owner.groupKey === 'cages'
            ? state.cages[owner.slotKey]
            : state.optionalRewards[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit trait offer before reward authorship',
          ),
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: binding.producerLifecycleKey,
          } as const,
        });
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        const room = catalog.rooms.byKey[occurrence.gameName];
        if (room === undefined) failCommand(command, `unknown room ${occurrence.gameName}`);
        const descriptor = requireShipCombatWheels(catalog, room, occurrence.gameName).find(
          (candidate) => candidate.key === owner.wheelKey,
        );
        if (descriptor === undefined)
          failCommand(command, `unknown reward wheel ${owner.wheelKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit trait offer before reward authorship',
          ),
          levelEffectSource: {
            kind: 'producerLifecycle',
            key: descriptor.reward.producerLifecycleKey,
          } as const,
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const reward = state.shop.offers[owner.offerKey]?.reward;
        if (reward === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return Object.freeze({
          reward: requireAuthoredReward(
            reward,
            command,
            'cannot edit trait offer before reward authorship',
          ),
          levelEffectSource: { kind: 'shopProfile', key: state.shop.profileKey } as const,
        });
      }
  }
}

export function updateTraitRewardState(
  catalog: Catalog,
  located: LocatedBiome,
  occurrence: RoomOccurrence,
  state: RoomOccurrence['state'],
  command: TraitOfferCommand,
  value: AuthoredTraitOffer,
  update: (
    reward: AuthoredRewardState,
    role: string,
    value: AuthoredTraitOffer,
  ) => AuthoredRewardState = updateReward,
): RoomOccurrence['state'] {
  const trait = commandTraitAddress(command);
  const owner = trait.owner;
  switch (owner.kind) {
    case 'acquisitionEntry':
      return failCommand(command, 'site pickup entries are updated on their occurrence overlay');
    case 'incomingReward':
      switch (state.kind) {
        case 'counted':
        case 'fixed':
        case 'anomaly':
        case 'ephyraCombat':
        case 'freeReward':
          return Object.freeze({
            ...state,
            reward: update(
              requireAuthoredReward(
                state.reward,
                command,
                'cannot edit trait offer before reward authorship',
              ),
              trait.acquisitionRole,
              value,
            ),
          });
        case 'none':
        case 'fieldsCombat':
        case 'shipCombat':
        case 'shop':
          failCommand(command, `incoming reward is not owned by ${occurrence.gameName}`);
      }
      break;
    case 'localReward':
      if (state.kind === 'fieldsCombat') {
        const room = catalog.rooms.byKey[occurrence.gameName];
        const cageGroup = room?.localChildren.find((child) => child.key === owner.groupKey);
        const slotKeys =
          cageGroup?.kind === 'boundedRewardSlots'
            ? cageGroup.slotKeys
            : room?.fieldsOptionalRewards?.key === owner.groupKey
              ? room.fieldsOptionalRewards.slotKeys
              : [];
        if (slotKeys.length === 0) {
          failCommand(
            command,
            `${occurrence.gameName} has no Fields reward group ${owner.groupKey}`,
          );
        }
        if (!slotKeys.includes(owner.slotKey)) {
          failCommand(command, `${occurrence.gameName} has no Fields reward slot ${owner.slotKey}`);
        }
        const reward =
          owner.groupKey === 'cages'
            ? state.cages[owner.slotKey]
            : state.optionalRewards[owner.slotKey];
        if (reward === undefined) failCommand(command, `missing Fields reward ${owner.slotKey}`);
        return Object.freeze({
          ...state,
          ...(owner.groupKey === 'cages'
            ? {
                cages: Object.freeze({
                  ...state.cages,
                  [owner.slotKey]: update(
                    requireAuthoredReward(
                      reward,
                      command,
                      'cannot edit trait offer before reward authorship',
                    ),
                    trait.acquisitionRole,
                    value,
                  ),
                }),
              }
            : {
                optionalRewards: Object.freeze({
                  ...state.optionalRewards,
                  [owner.slotKey]: update(
                    requireAuthoredReward(
                      reward,
                      command,
                      'cannot edit trait offer before reward authorship',
                    ),
                    trait.acquisitionRole,
                    value,
                  ),
                }),
              }),
        });
      }
      return failCommand(
        command,
        `${occurrence.gameName} has no local reward ${owner.groupKey}/${owner.slotKey}`,
      );
    case 'rewardWheelOffer':
      if (state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no reward wheel ${owner.wheelKey}`);
      }
      {
        const wheel = state.wheels[owner.wheelKey];
        const reward = wheel?.offers[owner.offerKey];
        if (wheel === undefined || reward === undefined) {
          failCommand(command, `missing reward wheel offer ${owner.wheelKey}/${owner.offerKey}`);
        }
        return Object.freeze({
          ...state,
          wheels: Object.freeze({
            ...state.wheels,
            [owner.wheelKey]: Object.freeze({
              ...wheel,
              offers: Object.freeze({
                ...wheel.offers,
                [owner.offerKey]: update(
                  requireAuthoredReward(
                    reward,
                    command,
                    'cannot edit trait offer before reward authorship',
                  ),
                  trait.acquisitionRole,
                  value,
                ),
              }),
            }),
          }),
        });
      }
    case 'shopOffer':
      if (state.kind !== 'shop' || state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized Shop offers`);
      }
      {
        const entry = state.shop.offers[owner.offerKey];
        if (entry === undefined) failCommand(command, `missing Shop offer ${owner.offerKey}`);
        return Object.freeze({
          ...state,
          shop: Object.freeze({
            ...state.shop,
            offers: Object.freeze({
              ...state.shop.offers,
              [owner.offerKey]: Object.freeze({
                ...entry,
                reward: update(
                  requireAuthoredReward(
                    entry.reward,
                    command,
                    'cannot edit trait offer before reward authorship',
                  ),
                  trait.acquisitionRole,
                  value,
                ),
              }),
            }),
          }),
        });
      }
    case 'encounterPhase':
      return failCommand(command, 'encounter trait offers are updated by the encounter owner path');
  }
  return failCommand(command, `unsupported trait offer owner ${owner.kind}`);
}

export function applyTraitOfferCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: TraitOfferCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const trait = commandTraitAddress(command);
  const owner = trait.owner;
  const occurrenceId =
    owner.kind === 'encounterPhase'
      ? owner.owner.occurrenceId
      : owner.kind === 'gorgonPhase'
        ? owner.encounter.owner.occurrenceId
        : owner.kind === 'acquisitionEntry'
          ? owner.site.owner.kind === 'occurrence'
            ? owner.site.owner.occurrenceId
            : failCommand(command, 'acquisition entry is not occurrence-owned')
          : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  if (owner.routeKey !== trait.routeKey || owner.biomeKey !== trait.biomeKey)
    failCommand(command, 'trait owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase' || owner.kind === 'gorgonPhase') {
    const phaseKey = owner.kind === 'gorgonPhase' ? owner.encounter.phaseKey : owner.phaseKey;
    const isGorgon = owner.kind === 'gorgonPhase';
    const currentEncounters = occurrence.encounters;
    const encounterRoom = catalog.rooms.byKey[occurrence.gameName];
    if (encounterRoom === undefined) failCommand(command, `unknown encounter room for ${phaseKey}`);
    const phaseGorgon = isGorgon ? currentEncounters.gorgonResultByPhase?.[phaseKey] : undefined;
    const phaseOffersValue = currentEncounters.traitOffersByPhase?.[phaseKey];
    const phaseOffers = phaseOffersValue;
    const encounterKey = selectedEncounterDefinitionKey(
      catalog,
      encounterRoom,
      currentEncounters,
      phaseKey,
      occurrence.gameName,
    );
    if (
      phaseKey.trim().length === 0 ||
      trait.acquisitionRole !== (isGorgon ? 'gorgonAthena' : 'selection')
    )
      failCommand(command, 'encounter trait offers use the bound acquisition role');
    if (
      command.kind === 'ReplaceTraitSelection' &&
      !['option1', 'option2', 'option3'].includes(command.selectedOptionKey)
    ) {
      failCommand(command, 'selected option must be option1, option2, or option3');
    }
    let nextEncounters: RoomOccurrence['encounters'];
    if (isGorgon) {
      const existing = phaseGorgon?.athenaOffer;
      if (existing === undefined) failCommand(command, `no trait offer at phase ${phaseKey}`);
      if (command.kind === 'ReplaceTraitOffer')
        failCommand(command, 'Gorgon Athena persists only its bound author decisions');
      if (command.kind === 'ReplaceConcaveStoneResult')
        failCommand(command, 'Gorgon Athena does not support Concave Stone results');
      const value =
        command.kind === 'ResetEncounterTraitOffer'
          ? null
          : command.kind === 'ReplaceTraitSelection'
            ? existing === null
              ? failCommand(command, 'trait offer must be authored as one complete offer')
              : Object.freeze({ ...existing, selectedOptionKey: command.selectedOptionKey })
            : validateGorgonAthenaOffer(catalog, command.value, command);
      if (sameOccurrenceValue(value, existing)) return document;
      nextEncounters = Object.freeze({
        ...currentEncounters,
        gorgonResultByPhase: Object.freeze({
          ...(currentEncounters.gorgonResultByPhase ?? {}),
          [phaseKey]: Object.freeze({
            ...(phaseGorgon ?? { athenaTriggerConditionMet: false }),
            athenaOffer: value,
          }),
        }),
      });
    } else {
      if (command.kind === 'ReplaceGorgonAthenaOffer')
        failCommand(command, 'Gorgon Athena decisions require a Gorgon phase owner');
      const existing = phaseOffers?.[encounterKey];
      if (existing === undefined) failCommand(command, `no trait offer at phase ${phaseKey}`);
      const expectedProducer = catalog.encounterDefinitions.byKey[encounterKey]?.traitOfferProducer;
      if (expectedProducer === undefined)
        failCommand(command, `encounter ${encounterKey} has no trait offer producer`);
      if (existing !== null && existing.giverKey !== expectedProducer.giverKey)
        failCommand(command, `trait offer giver must be ${expectedProducer.giverKey}`);
      if (
        command.kind === 'ReplaceTraitSelection' &&
        (existing === null ||
          existing.kind !== 'traits' ||
          traitOfferOption(existing, command.selectedOptionKey) === undefined)
      )
        failCommand(command, 'selected option is not materialized by this trait offer');
      const value = replaceTraitOfferValue(catalog, existing, command);
      if (value !== null && value.giverKey !== expectedProducer.giverKey)
        failCommand(command, `trait offer giver must be ${expectedProducer.giverKey}`);
      if (sameOccurrenceValue(value, existing)) return document;
      nextEncounters = Object.freeze({
        ...currentEncounters,
        traitOffersByPhase: Object.freeze({
          ...(currentEncounters.traitOffersByPhase ?? {}),
          [phaseKey]: Object.freeze({ ...(phaseOffers ?? {}), [encounterKey]: value }),
        }),
      });
    }
    const reconciled = reconcileSelectedPickupProducerState(
      catalog,
      createBiomeAddress(trait.routeKey, trait.biomeKey),
      Object.freeze({ ...occurrence, encounters: nextEncounters }),
    );
    return updateOccurrenceTopology(document, located, replaceOccurrence(topology, reconciled));
  }
  const reward = locateTraitReward(catalog, located, occurrence, occurrence.state, command);
  if (command.kind === 'ResetEncounterTraitOffer')
    failCommand(command, 'only encounter-owned trait offers can be reset');
  if (reward === undefined) failCommand(command, `no trait offer at role ${trait.acquisitionRole}`);
  const existing = reward.reward.traitOffersByAcquisitionRole[trait.acquisitionRole];
  if (existing === undefined)
    failCommand(command, `no trait offer at role ${trait.acquisitionRole}`);
  const expectedGiver = traitGiverForAcquisitionRole(
    catalog,
    reward.reward.offer,
    trait.acquisitionRole,
  );
  if (expectedGiver === undefined) {
    failCommand(command, `no catalog trait provider at role ${trait.acquisitionRole}`);
  }
  if (existing !== null && existing.giverKey !== expectedGiver) {
    failCommand(command, `trait offer giver must be ${expectedGiver}`);
  }
  if (command.kind === 'ReplaceGorgonAthenaOffer')
    failCommand(command, 'Gorgon Athena decisions require a Gorgon phase owner');
  if (
    command.kind === 'ReplaceTraitSelection' &&
    !['option1', 'option2', 'option3'].includes(command.selectedOptionKey)
  ) {
    failCommand(command, 'selected option must be option1, option2, or option3');
  }
  if (
    command.kind === 'ReplaceTraitSelection' &&
    (existing === null ||
      existing.kind !== 'traits' ||
      traitOfferOption(existing, command.selectedOptionKey) === undefined)
  )
    failCommand(command, 'selected option is not materialized by this trait offer');
  const value = replaceTraitOfferValue(catalog, existing, command);
  if (value === null) failCommand(command, 'only encounter-owned trait offers can be reset');
  if (value.giverKey !== expectedGiver) {
    failCommand(command, `trait offer giver must be ${expectedGiver}`);
  }
  if (sameOccurrenceValue(value, existing)) return document;
  if (owner.kind === 'acquisitionEntry') {
    const exactSite = owner.site.pointKey !== 'roomExit';
    const pickup = exactSite
      ? authoredAcquisitionEntryAtSite(occurrence, owner.site, owner.entryKey)
      : authoredAcquisitionEntry(catalog, occurrence, owner.entryKey);
    if (pickup === undefined || pickup === null)
      failCommand(command, `missing pickup entry ${owner.entryKey}`);
    const nextPickup = updateReward(pickup, trait.acquisitionRole, value);
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        exactSite
          ? replaceAuthoredAcquisitionEntryAtSite(
              occurrence,
              owner.site,
              owner.entryKey,
              nextPickup,
            )
          : replaceAuthoredAcquisitionEntry(occurrence, owner.entryKey, nextPickup),
      ),
    );
  }
  const state = updateTraitRewardState(
    catalog,
    located,
    occurrence,
    occurrence.state,
    command,
    value,
  );
  const nextOccurrence = Object.freeze({ ...occurrence, state });
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(
      topology,
      reconcileSelectedPickupProducerState(
        catalog,
        createBiomeAddress(trait.routeKey, trait.biomeKey),
        nextOccurrence,
      ),
    ),
  );
}

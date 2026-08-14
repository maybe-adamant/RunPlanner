import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../model';
import type { AuthoredLevelResolution } from '../traits';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import {
  locateTraitReward,
  updateLevelResolutionReward,
  updateTraitRewardState,
} from './trait-offer';
import type { LevelResolutionCommand, TraitOfferCommand } from './types';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';

function validate(
  catalog: Catalog,
  effect: NonNullable<ReturnType<typeof levelResolutionEffectFor>>,
  value: AuthoredLevelResolution,
  command: LevelResolutionCommand,
): AuthoredLevelResolution {
  if (effect.kind === 'visibleChoice') {
    if (value.kind !== 'choice') failCommand(command, 'Pom acquisition requires a visible choice');
    if (new Set(value.offeredTraitKeys).size !== value.offeredTraitKeys.length)
      failCommand(command, 'Pom offered trait keys must be distinct');
    for (const key of value.offeredTraitKeys)
      if (catalog.traits.byKey[key] === undefined) failCommand(command, `unknown trait ${key}`);
    if (
      value.selectedTraitKey !== null &&
      catalog.traits.byKey[value.selectedTraitKey] === undefined
    )
      failCommand(command, `unknown trait ${value.selectedTraitKey}`);
    if (value.selectedTraitKey !== null && !value.offeredTraitKeys.includes(value.selectedTraitKey))
      failCommand(command, 'Pom selected trait must be one of the offered traits');
    return Object.freeze({
      kind: 'choice',
      offeredTraitKeys: Object.freeze([...value.offeredTraitKeys]),
      selectedTraitKey: value.selectedTraitKey,
    });
  }
  if (value.kind !== 'random')
    failCommand(command, 'random Pom acquisition requires one exact target');
  if (value.targetTraitKey !== null && catalog.traits.byKey[value.targetTraitKey] === undefined)
    failCommand(command, `unknown trait ${value.targetTraitKey}`);
  return Object.freeze({ kind: 'random', targetTraitKey: value.targetTraitKey });
}

export function applyLevelResolutionCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: LevelResolutionCommand,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const owner = command.levelResolution.owner;
  if (
    owner.routeKey !== command.levelResolution.routeKey ||
    owner.biomeKey !== command.levelResolution.biomeKey
  )
    failCommand(command, 'level-resolution owner is outside its addressed biome');
  if (owner.kind === 'encounterPhase' || owner.kind === 'gorgonPhase')
    failCommand(command, 'encounter phases do not own Pom level resolutions');
  const occurrenceId =
    owner.kind === 'acquisitionEntry'
      ? owner.site.owner.kind === 'occurrence'
        ? owner.site.owner.occurrenceId
        : failCommand(command, 'acquisition entry is not occurrence-owned')
      : owner.occurrenceId;
  const occurrence = requireOccurrence(located.plan, occurrenceId, command);
  const shim = {
    kind: 'ReplaceTraitOffer',
    trait: { ...command.levelResolution, kind: 'traitOffer' },
  } as unknown as TraitOfferCommand;
  const locatedReward = locateTraitReward(catalog, located, occurrence, occurrence.state, shim);
  if (locatedReward === undefined)
    failCommand(command, `no reward at role ${command.levelResolution.acquisitionRole}`);
  const effect = levelResolutionEffectFor(
    catalog.rewards,
    locatedReward.reward.offer,
    locatedReward.levelEffectSource,
    command.levelResolution.acquisitionRole,
  );
  if (effect === undefined)
    failCommand(
      command,
      `no Pom level-resolution effect at role ${command.levelResolution.acquisitionRole}`,
    );
  const value = validate(catalog, effect, command.value, command);
  const existing =
    locatedReward.reward.levelResolutionsByAcquisitionRole?.[
      command.levelResolution.acquisitionRole
    ];
  if (JSON.stringify(existing) === JSON.stringify(value)) return document;
  if (owner.kind === 'acquisitionEntry') {
    const site = occurrence.acquisitionSites?.roomExit;
    const pickup = site?.pickupEntries?.[owner.entryKey];
    if (site === undefined || pickup === undefined)
      failCommand(command, `missing pickup entry ${owner.entryKey}`);
    const nextPickup = updateLevelResolutionReward(
      pickup,
      command.levelResolution.acquisitionRole,
      value,
    );
    return updateOccurrenceTopology(
      document,
      located,
      replaceOccurrence(
        topology,
        Object.freeze({
          ...occurrence,
          acquisitionSites: Object.freeze({
            ...(occurrence.acquisitionSites ?? {}),
            roomExit: Object.freeze({
              ...site,
              pickupEntries: Object.freeze({ ...site.pickupEntries, [owner.entryKey]: nextPickup }),
            }),
          }),
        }),
      ),
    );
  }
  const state = updateTraitRewardState(
    catalog,
    located,
    occurrence,
    occurrence.state,
    shim,
    value as never,
    updateLevelResolutionReward as never,
  );
  return updateOccurrenceTopology(
    document,
    located,
    replaceOccurrence(topology, Object.freeze({ ...occurrence, state })),
  );
}

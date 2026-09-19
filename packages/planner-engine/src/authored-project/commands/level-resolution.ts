import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, AuthoredRewardState } from '../model';
import type { AuthoredLevelResolution } from '../traits/state';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import { failCommand, requireOccurrence, requireTopology, type LocatedBiome } from './contract';
import { locateReward, updateRewardState } from './acquisition/reward-source';
import {
  isRouteStartIncomingReward,
  startingRewardAcquisitionFrom,
} from '../room-state/starting-reward';
import type { LevelResolutionCommand } from './types';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence/mutation';
import {
  authoredAcquisitionEntry,
  authoredAcquisitionEntryAtSite,
  replaceAuthoredAcquisitionEntry,
  replaceAuthoredAcquisitionEntryAtSite,
} from '../shop';

function updateLevelResolutionReward(
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
  const locatedReward = locateReward(
    document,
    catalog,
    located.routePosition,
    occurrence,
    occurrence.state,
    owner,
    command,
  );
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
    const exactSite = owner.site.pointKey !== 'roomExit';
    const pickup = exactSite
      ? authoredAcquisitionEntryAtSite(occurrence, owner.site, owner.entryKey)
      : authoredAcquisitionEntry(catalog, occurrence, owner.entryKey);
    if (pickup === undefined || pickup === null)
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
  const nextReward = updateLevelResolutionReward(
    locatedReward.reward,
    command.levelResolution.acquisitionRole,
    value,
  );
  const nextOccurrence = isRouteStartIncomingReward(document, located.routePosition, occurrence)
    ? Object.freeze({
        ...occurrence,
        startingRewardAcquisition: startingRewardAcquisitionFrom(nextReward),
      })
    : Object.freeze({
        ...occurrence,
        state: updateRewardState(
          catalog,
          occurrence,
          occurrence.state,
          owner,
          command,
          () => nextReward,
        ),
      });
  return updateOccurrenceTopology(document, located, replaceOccurrence(topology, nextOccurrence));
}

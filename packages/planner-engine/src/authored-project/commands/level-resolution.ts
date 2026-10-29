import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument, AuthoredRewardState } from '../model';
import type { AuthoredLevelResolution } from '../traits/state';
import { levelResolutionEffectFor } from '../../reward-kernel/level-effects';
import {
  normalizeRerolledLevelScreen,
  normalizeRerolledScreens,
  rerolledLevelScreenSnapshot,
  rerolledScreensField,
  screenRerollSupported,
  withRerolledScreenReplaced,
  withScreenRerollInserted,
  withScreenRerollRemoved,
} from '../screen-rerolls';
import {
  failCommand,
  ProjectCommandContractError,
  requireOccurrence,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { locateReward, replaceOwnedReward } from './acquisition/reward-source';
import type { LevelResolutionCommand } from './types';

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
  rewardType: string,
  existing: AuthoredLevelResolution | undefined,
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
    const supported = screenRerollSupported(catalog, { kind: 'levelChoice', rewardType });
    let screens;
    try {
      screens = normalizeRerolledScreens(
        value.rerolledScreens ??
          (existing?.kind === 'choice' ? existing.rerolledScreens : undefined),
        supported,
        (screen) => normalizeRerolledLevelScreen(catalog, screen),
      );
    } catch (error) {
      return failCommand(command, error instanceof Error ? error.message : 'invalid Pom rerolls');
    }
    return Object.freeze({
      kind: 'choice',
      offeredTraitKeys: Object.freeze([...value.offeredTraitKeys]),
      selectedTraitKey: value.selectedTraitKey,
      ...rerolledScreensField(screens),
    });
  }
  if (value.kind !== 'random')
    failCommand(command, 'random Pom acquisition requires one exact target');
  if (value.targetTraitKey !== null && catalog.traits.byKey[value.targetTraitKey] === undefined)
    failCommand(command, `unknown trait ${value.targetTraitKey}`);
  return Object.freeze({ kind: 'random', targetTraitKey: value.targetTraitKey });
}

/** Adds, removes or replaces one earlier Pom screen; the final screen is untouched. */
function applyLevelScreenRerollCommand(
  catalog: Catalog,
  existing: AuthoredLevelResolution | undefined,
  command: Exclude<LevelResolutionCommand, { readonly kind: 'ReplaceLevelResolution' }>,
  rewardType: string,
): AuthoredLevelResolution {
  if (existing?.kind !== 'choice')
    return failCommand(command, 'only a visible Pom choice can be rerolled');
  try {
    let screens;
    if (command.kind === 'InsertLevelScreenReroll') {
      if (!screenRerollSupported(catalog, { kind: 'levelChoice', rewardType }))
        failCommand(command, `${rewardType} screens cannot be rerolled`);
      screens = withScreenRerollInserted(
        existing.rerolledScreens,
        rerolledLevelScreenSnapshot(existing),
      );
    } else if (command.kind === 'RemoveLevelScreenReroll')
      screens = withScreenRerollRemoved(existing.rerolledScreens);
    else
      screens = withRerolledScreenReplaced(
        existing.rerolledScreens,
        command.index,
        command.value === null ? null : normalizeRerolledLevelScreen(catalog, command.value),
      );
    const { rerolledScreens: _previous, ...rest } = existing;
    void _previous;
    return Object.freeze({ ...rest, ...rerolledScreensField(screens) });
  } catch (error) {
    if (error instanceof ProjectCommandContractError) throw error;
    return failCommand(command, error instanceof Error ? error.message : 'invalid screen reroll');
  }
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
    located.routePosition.routeKey,
  );
  if (effect === undefined)
    failCommand(
      command,
      `no Pom level-resolution effect at role ${command.levelResolution.acquisitionRole}`,
    );
  const existing =
    locatedReward.reward.levelResolutionsByAcquisitionRole?.[
      command.levelResolution.acquisitionRole
    ];
  const value =
    command.kind === 'ReplaceLevelResolution'
      ? validate(
          catalog,
          effect,
          command.value,
          command,
          locatedReward.reward.offer.rewardType,
          existing,
        )
      : applyLevelScreenRerollCommand(
          catalog,
          existing,
          command,
          locatedReward.reward.offer.rewardType,
        );
  if (JSON.stringify(existing) === JSON.stringify(value)) return document;
  return replaceOwnedReward(
    document,
    catalog,
    located,
    topology,
    occurrence,
    owner,
    command,
    updateLevelResolutionReward(
      locatedReward.reward,
      command.levelResolution.acquisitionRole,
      value,
    ),
  );
}

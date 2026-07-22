import type {
  CatalogCollection,
  EncounterPhasePresence,
  EncounterPhase,
  EncounterPhaseKind,
  EncounterProfile,
  RewardWheelOfferPoint,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawEncounterProfileDeclaration } from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import { normalizeRequirement, validateRequirementReferences } from './requirements';
import { normalizeRewardBinding } from './rewardBindings';

const encounterPhaseKinds = new Set<EncounterPhaseKind>([
  'boss',
  'combat',
  'miniboss',
  'nonCombat',
  'story',
]);

export function normalizeEncounterProfiles(
  rawProfiles: readonly RawEncounterProfileDeclaration[],
  rewards: RewardKernelCatalog,
): CatalogCollection<EncounterProfile> {
  const profiles = rawProfiles.map((profile, profileIndex): EncounterProfile => {
    const path = `encounterProfiles[${profileIndex}]`;
    requireNonEmpty(profile.key, `${path}.key`);
    const seenPhases = new Set<string>();
    const seenOfferPoints = new Set<string>();
    const phases = profile.phases.map((phase, phaseIndex): EncounterPhase => {
      const phasePath = `${path}.phases[${phaseIndex}]`;
      requireNonEmpty(phase.key, `${phasePath}.key`);
      if (seenPhases.has(phase.key)) {
        fail(`${phasePath}.key`, `duplicates phase ${phase.key}`);
      }
      seenPhases.add(phase.key);
      if (!encounterPhaseKinds.has(phase.kind)) {
        fail(`${phasePath}.kind`, `unknown encounter phase kind ${String(phase.kind)}`);
      }
      if (typeof phase.countsEncounterDepth !== 'boolean') {
        fail(`${phasePath}.countsEncounterDepth`, 'must be boolean');
      }
      let presence: EncounterPhasePresence | undefined;
      if (phase.presence !== undefined) {
        if (phase.presence.kind !== 'authoredOptional') {
          fail(
            `${phasePath}.presence.kind`,
            `unknown encounter presence ${String(phase.presence.kind)}`,
          );
        }
        if (phase.presence.decisionPoint !== 'prepareRoom') {
          fail(
            `${phasePath}.presence.decisionPoint`,
            `unknown presence decision point ${String(phase.presence.decisionPoint)}`,
          );
        }
        if (typeof phase.presence.defaultActive !== 'boolean') {
          fail(`${phasePath}.presence.defaultActive`, 'must be boolean');
        }
        presence = Object.freeze({
          kind: 'authoredOptional',
          decisionPoint: 'prepareRoom',
          requirement: normalizeRequirement(
            phase.presence.requirement,
            `${phasePath}.presence.requirement`,
          ),
          defaultActive: phase.presence.defaultActive,
        });
        validateRequirementReferences(
          presence.requirement,
          rewards.rewardTypes,
          `${phasePath}.presence.requirement`,
        );
      }
      let offerPoint: RewardWheelOfferPoint | undefined;
      if (phase.offerPoint !== undefined) {
        const offerPath = `${phasePath}.offerPoint`;
        if (phase.offerPoint.kind !== 'rewardWheel') {
          fail(`${offerPath}.kind`, `unknown offer point ${String(phase.offerPoint.kind)}`);
        }
        const key = requireNonEmpty(phase.offerPoint.key, `${offerPath}.key`);
        if (seenOfferPoints.has(key)) {
          fail(`${offerPath}.key`, `duplicates offer point ${key}`);
        }
        seenOfferPoints.add(key);
        if (!phase.countsEncounterDepth) {
          fail(offerPath, 'reward wheels require a counting encounter phase');
        }
        const reward = normalizeRewardBinding(
          phase.offerPoint.reward,
          rewards,
          `${offerPath}.reward`,
        );
        if (reward.kind !== 'countedChoice') {
          fail(`${offerPath}.reward.kind`, 'reward wheels require countedChoice');
        }
        if (!reward.storeKeys.includes(phase.offerPoint.defaultStoreKey)) {
          fail(`${offerPath}.defaultStoreKey`, 'must belong to the wheel reward store domain');
        }
        const offerKeys = freezeUniqueStrings(phase.offerPoint.offerKeys, `${offerPath}.offerKeys`);
        if (offerKeys.length === 0) {
          fail(`${offerPath}.offerKeys`, 'must not be empty');
        }
        const min = requirePositiveInteger(
          phase.offerPoint.offerCount.min,
          `${offerPath}.offerCount.min`,
        );
        const max = requirePositiveInteger(
          phase.offerPoint.offerCount.max,
          `${offerPath}.offerCount.max`,
        );
        const defaultValue = requirePositiveInteger(
          phase.offerPoint.offerCount.defaultValue,
          `${offerPath}.offerCount.defaultValue`,
        );
        if (max < min || max !== offerKeys.length) {
          fail(`${offerPath}.offerCount.max`, 'must equal offer slot capacity and be at least min');
        }
        if (defaultValue < min || defaultValue > max) {
          fail(`${offerPath}.offerCount.defaultValue`, 'must be within the offer-count range');
        }
        if (phase.offerPoint.picked !== 'exactlyOne') {
          fail(
            `${offerPath}.picked`,
            `unknown wheel pick policy ${String(phase.offerPoint.picked)}`,
          );
        }
        if (phase.offerPoint.offerTiming !== 'encounterStart') {
          fail(
            `${offerPath}.offerTiming`,
            `unknown wheel offer timing ${String(phase.offerPoint.offerTiming)}`,
          );
        }
        if (phase.offerPoint.acquisitionTiming !== 'postCombat') {
          fail(
            `${offerPath}.acquisitionTiming`,
            `unknown wheel acquisition timing ${String(phase.offerPoint.acquisitionTiming)}`,
          );
        }
        offerPoint = Object.freeze({
          kind: 'rewardWheel',
          key,
          reward,
          defaultStoreKey: phase.offerPoint.defaultStoreKey,
          offerKeys,
          offerCount: Object.freeze({ min, max, defaultValue }),
          picked: 'exactlyOne',
          offerTiming: 'encounterStart',
          acquisitionTiming: 'postCombat',
        });
      }
      return Object.freeze({
        key: phase.key,
        kind: phase.kind,
        countsEncounterDepth: phase.countsEncounterDepth,
        ...(phase.baselineEncounterKey === undefined
          ? {}
          : {
              baselineEncounterKey: requireNonEmpty(
                phase.baselineEncounterKey,
                `${phasePath}.baselineEncounterKey`,
              ),
            }),
        ...(presence === undefined ? {} : { presence }),
        ...(offerPoint === undefined ? {} : { offerPoint }),
      });
    });

    return Object.freeze({ key: profile.key, phases: Object.freeze(phases) });
  });

  return createCollection(profiles, 'encounterProfiles', (profile) => profile.key);
}

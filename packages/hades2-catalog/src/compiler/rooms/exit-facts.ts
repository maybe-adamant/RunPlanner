import type {
  AdditionalExitDeclaration,
  CatalogCollection,
  ExitTypeDeclaration,
  RoomDeclaration,
  RoomExit,
} from '@run-planner/engine/catalog-schema';
import type { RewardKernelCatalog } from '@run-planner/engine/reward-kernel';

import type { RawAdditionalExitDeclaration, RawRoomDeclaration } from '../../declarations/index';
import { freezeUniqueStrings, requireNonEmpty, requireNonNegativeInteger } from '../common';
import { type RoomIdentityFacts } from './core-facts';
import { type RoomEncounterFacts } from './encounter-facts';
import { fail } from '../errors';
import {
  normalizeRequirement,
  rejectEncounterHistoryRequirements,
  validateRequirementReferences,
} from '../requirements';

export type RoomExitFacts = Pick<RoomDeclaration, 'exits' | 'additionalExits'>;

function normalizeAdditionalExits(
  rawExits: readonly RawAdditionalExitDeclaration[],
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  rewards: RewardKernelCatalog,
  path: string,
): readonly AdditionalExitDeclaration[] {
  const keys = freezeUniqueStrings(
    rawExits.map((exit) => exit.key),
    `${path}.keys`,
  );
  return Object.freeze(
    rawExits.map((raw, index): AdditionalExitDeclaration => {
      const exitPath = `${path}[${index}]`;
      if (raw.kind !== 'zagreusContract' && raw.kind !== 'chaos') {
        fail(
          `${exitPath}.kind`,
          `unknown additional exit ${String((raw as { kind?: unknown }).kind)}`,
        );
      }
      const key = keys[index];
      const exitTypeKey = requireNonEmpty(raw.exitType, `${exitPath}.exitType`);
      const exitType = exitTypes.byKey[exitTypeKey];
      if (exitType === undefined)
        fail(`${exitPath}.exitType`, `unknown physical exit type ${exitTypeKey}`);
      if (raw.kind === 'chaos') {
        if (key !== 'chaos') fail(`${exitPath}.key`, 'chaos exit key must be chaos');
        if (exitType.key !== 'ChaosExitDoor')
          fail(`${exitPath}.exitType`, 'chaos exits must use ChaosExitDoor');
        if (
          exitType.behavior.kind !== 'playerSelected' ||
          exitType.behavior.rewardPreview !== 'hidden'
        ) {
          fail(`${exitPath}.exitType`, 'chaos exits must be player-selected and hidden');
        }
        if (typeof raw.canHost !== 'boolean') fail(`${exitPath}.canHost`, 'must be a boolean');
        if (typeof raw.canSpawn !== 'boolean') fail(`${exitPath}.canSpawn`, 'must be a boolean');
        if (raw.canSpawn && !raw.canHost)
          fail(`${exitPath}.canSpawn`, 'cannot be true when canHost is false');
        const requirement =
          raw.requirement === undefined
            ? undefined
            : normalizeRequirement(raw.requirement, `${exitPath}.requirement`);
        if (requirement !== undefined) {
          validateRequirementReferences(
            requirement,
            rewards.rewardTypes,
            `${exitPath}.requirement`,
          );
          rejectEncounterHistoryRequirements(requirement, `${exitPath}.requirement`);
        }
        return Object.freeze({
          kind: 'chaos',
          key: 'chaos',
          canHost: raw.canHost,
          canSpawn: raw.canSpawn,
          physicalExit: Object.freeze({
            type: exitType.key,
            compatibilityPolicyKey: exitType.compatibilityPolicyKey,
            behavior: exitType.behavior,
          }),
          ...(requirement === undefined ? {} : { requirement }),
        });
      }
      if (key !== 'zagreusContract')
        fail(`${exitPath}.key`, 'Zagreus contract exit key must be zagreusContract');
      if (
        exitType.behavior.kind !== 'playerSelected' ||
        exitType.behavior.rewardPreview !== 'hidden'
      ) {
        fail(`${exitPath}.exitType`, 'Zagreus contract exits must be player-selected and hidden');
      }
      const maxEnteredThisRoute = requireNonNegativeInteger(
        raw.maxEnteredThisRoute,
        `${exitPath}.maxEnteredThisRoute`,
      );
      if (maxEnteredThisRoute !== 0) {
        fail(
          `${exitPath}.maxEnteredThisRoute`,
          'Zagreus contract entry limit must be zero prior entries',
        );
      }
      return Object.freeze({
        kind: 'zagreusContract',
        key: 'zagreusContract',
        physicalExit: Object.freeze({
          type: exitType.key,
          compatibilityPolicyKey: exitType.compatibilityPolicyKey,
          behavior: exitType.behavior,
        }),
        targetRoomGameName: requireNonEmpty(
          raw.targetRoomGameName,
          `${exitPath}.targetRoomGameName`,
        ),
        maxEnteredThisRoute,
      });
    }),
  );
}

/** Normalizes physical and additional exits, including closed host-continuation constraints. */
export function normalizeRoomExitFacts(
  room: RawRoomDeclaration,
  identity: RoomIdentityFacts,
  encounter: RoomEncounterFacts,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  rewards: RewardKernelCatalog,
  path: string,
): RoomExitFacts {
  if (
    room.exits.length === 0 &&
    !(identity.mode.kind === 'derived' && identity.mode.classification === 'hub')
  ) {
    fail(`${path}.exits`, 'must not be empty');
  }
  const exits = room.exits.map((exit, exitIndex): RoomExit => {
    const exitPath = `${path}.exits[${exitIndex}]`;
    if (exit.index !== exitIndex + 1)
      fail(`${exitPath}.index`, `must equal physical exit index ${exitIndex + 1}`);
    const type = requireNonEmpty(exit.type, `${exitPath}.type`);
    const exitType = exitTypes.byKey[type];
    if (exitType === undefined) fail(`${exitPath}.type`, `unknown physical exit type ${type}`);
    return Object.freeze({
      index: exit.index,
      type,
      compatibilityPolicyKey: exitType.compatibilityPolicyKey,
      behavior: exitType.behavior,
    });
  });
  const automaticExits = exits.filter((exit) => exit.behavior.kind === 'automaticHostContinuation');
  const requiresAutomaticHostExit =
    identity.mode.kind === 'authored' &&
    (identity.mode.templateKey === 'Anomaly' || identity.mode.templateKey === 'ContractBoss');
  if (
    requiresAutomaticHostExit
      ? exits.length !== 1 || automaticExits.length !== 1
      : automaticExits.length !== 0
  ) {
    fail(
      `${path}.exits`,
      requiresAutomaticHostExit
        ? `${identity.gameName} must declare exactly one automatic host continuation`
        : 'automatic host continuation is not supported by this room',
    );
  }
  if (
    identity.mode.kind === 'authored' &&
    identity.mode.templateKey === 'Anomaly' &&
    identity.roomSetKey !== 'Anomaly'
  )
    fail(`${path}.roomSetKey`, 'Anomaly template requires the Anomaly room set');
  if (
    identity.mode.kind === 'authored' &&
    identity.mode.templateKey === 'ContractBoss' &&
    identity.roomSetKey !== 'C'
  )
    fail(`${path}.roomSetKey`, 'ContractBoss template requires the C room set');
  if (
    identity.mode.kind === 'authored' &&
    identity.mode.templateKey === 'Chaos' &&
    identity.roomSetKey !== 'Chaos'
  )
    fail(`${path}.roomSetKey`, 'Chaos template requires the Chaos room set');
  if (
    identity.roomSetKey === 'Anomaly' &&
    (identity.mode.kind !== 'authored' || identity.mode.templateKey !== 'Anomaly')
  )
    fail(`${path}.roomSetKey`, 'Anomaly room set requires authored Anomaly rooms');
  if (
    identity.roomSetKey === 'C' &&
    (identity.mode.kind !== 'authored' || identity.mode.templateKey !== 'ContractBoss')
  )
    fail(`${path}.roomSetKey`, 'C room set requires authored ContractBoss rooms');
  if (identity.roomSetKey === 'Chaos') {
    if (identity.mode.kind !== 'authored' || identity.mode.templateKey !== 'Chaos')
      fail(`${path}.roomSetKey`, 'Chaos room set requires authored Chaos rooms');
    if (
      exits.length === 0 ||
      exits.some(
        (exit, index) =>
          exit.index !== index + 1 ||
          exit.type !== 'ChaosReturnExitDoor' ||
          exit.behavior.kind !== 'playerSelected' ||
          exit.behavior.rewardPreview !== 'visible',
      )
    ) {
      fail(
        `${path}.exits`,
        'Chaos rooms require ordered visible player-selected ChaosReturnExitDoors',
      );
    }
    const binding = encounter.encounterSlotBindings[0];
    if (
      encounter.encounterEnvelopeKey !== 'SingleEncounter' ||
      encounter.encounterSlotBindings.length !== 1 ||
      binding?.slotKey !== 'Encounter' ||
      binding.kind !== 'fixed' ||
      binding.encounterDefinitionKey !== 'Empty_Chaos'
    ) {
      fail(`${path}.encounterSlotBindings`, 'Chaos rooms require fixed Empty_Chaos');
    }
    if (
      room.incomingReward.kind !== 'fixed' ||
      room.incomingReward.rewardType !== 'TrialUpgrade' ||
      room.incomingReward.producerLifecycleKey !== 'RoomReward'
    ) {
      fail(`${path}.incomingReward`, 'Chaos rooms require fixed TrialUpgrade RoomReward');
    }
  }
  const additionalExits = normalizeAdditionalExits(
    room.additionalExits ?? [],
    exitTypes,
    rewards,
    `${path}.additionalExits`,
  );
  if (
    additionalExits.length > 0 &&
    room.additionalExits?.some((exit) => exit.kind === 'zagreusContract') &&
    (room.kind !== 'Shop' || room.incomingReward.kind !== 'shop')
  ) {
    fail(`${path}.additionalExits`, 'additional Zagreus exits require a Shop room');
  }
  return Object.freeze({ exits: Object.freeze(exits), additionalExits });
}

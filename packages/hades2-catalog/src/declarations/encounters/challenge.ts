import type { EncounterMoneyStore } from '@run-planner/engine/catalog-schema';

import { generatedEncounterChoices } from './generated/policies';
import {
  ephyraMoneyStore,
  fieldsMoneyStore,
  generatedMoneyStore,
  oceanusMoneyStore,
  olympusMoneyStore,
  summitMoneyStore,
  tartarusMoneyStore,
  thessalyMoneyStore,
} from './money-stores';
import type { RawEncounterDefinitionDeclaration } from './types';

/**
 * Each RoomSet's GeneratedX store: no challenge base declares MoneyDropCap*,
 * and HandleSecretSpawns generates the encounter, drawing it at room entry.
 */
const moneyStoreBySet = {
  F: generatedMoneyStore,
  G: oceanusMoneyStore,
  H: fieldsMoneyStore,
  I: tartarusMoneyStore,
  N: ephyraMoneyStore,
  O: thessalyMoneyStore,
  P: olympusMoneyStore,
  Q: summitMoneyStore,
} as const satisfies Readonly<Record<string, EncounterMoneyStore>>;

type ChallengeSet = keyof typeof moneyStoreBySet;

// TimeChallenge, PerfectClear and EliteChallenge each declare CanEncounterSkip false and
// BlockAthenaEncounterKeepsake true, and inherit Generated's CountsForRoomEncounterDepth,
// which StartEncounter applies to any encounter (RoomLogic.lua:1900-1904).
// Their end runs no encounter-end clocks (RoomLogic.lua:2937 skips any
// encounter but the room's), so no Shrine delivery advances.
const shared = {
  kind: 'combat',
  countsEncounterDepth: true,
  advancesHermesShrineDeliveryUses: false,
  blocksGorgon: true,
} as const;

function challengeDefinitions(set: ChallengeSet): readonly RawEncounterDefinitionDeclaration[] {
  const moneyStore = moneyStoreBySet[set];
  return [
    {
      ...shared,
      key: `TimeChallenge${set}`,
      label: 'Time challenge',
      moneyStore,
      customization: [generatedEncounterChoices[`TimeChallenge${set}`]],
    },
    {
      ...shared,
      key: `PerfectClearChallenge${set}`,
      label: 'Perfect Clear challenge',
      moneyStore,
      customization: [generatedEncounterChoices[`PerfectClearChallenge${set}`]],
    },
    // One generated elite (ManualWaveTemplates TotalCount 1); its roster is the
    // switch's elite pin, declared with the switches.
    { ...shared, key: `EliteChallenge${set}`, label: 'Elite challenge', moneyStore },
  ];
}

/** The 24 encounters a challenge switch fields: Time, PerfectClear and Elite per RoomSet. */
export const challengeEncounterDefinitions = (
  Object.keys(moneyStoreBySet) as ChallengeSet[]
).flatMap(challengeDefinitions);

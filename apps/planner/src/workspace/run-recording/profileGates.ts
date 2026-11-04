import type { ClosedRun } from './runRecorder';

/**
 * What a recorded profile must own for the planner's mature profile to describe
 * its run, each read from the profile's stored progression at the run's start.
 */
export type ProfileGate =
  | 'trueEnding'
  | 'arcanaRanks'
  | 'aspectRank'
  | 'keepsakeRanks'
  | 'familiarRank'
  | 'autoHarvestOnExit';

export const PROFILE_GATES: readonly ProfileGate[] = [
  'trueEnding',
  'arcanaRanks',
  'aspectRank',
  'keepsakeRanks',
  'familiarRank',
  'autoHarvestOnExit',
];

const ARCANA_RANK = 3;
const ASPECT_RANK = 5;
/** A keepsake reaches rank III at 75 chambers (`ChamberThresholds` 25, 50 apart). */
const KEEPSAKE_RANK_III_CHAMBERS = 75;

/** Each familiar's three shop upgrades (`FamiliarShopItemData`), bought at levels 1 to 3. */
const FAMILIAR_UPGRADES: Readonly<Record<string, readonly string[]>> = {
  FrogFamiliar: ['FrogHealthBonus', 'FrogUses', 'FrogDamage'],
  CatFamiliar: ['CatLastStandHeal', 'CatUses', 'CatAttack'],
  RavenFamiliar: ['RavenCritChanceBonus', 'RavenUses', 'RavenAttack'],
  HoundFamiliar: ['HoundManaBonus', 'HoundUses', 'HoundAttack'],
  PolecatFamiliar: ['PolecatDodgeBonus', 'PolecatUses', 'PolecatDamage'],
};
const FAMILIAR_UPGRADE_LEVELS = ['', '2', '3'];

/**
 * The gates a closed run's profile fails, in `PROFILE_GATES` order; none for a
 * new profile's first attempt (run count 0), which the Fresh File route
 * describes. A run whose start save keeps no progression fails every gate.
 */
export function unmetProfileGates(
  run: Pick<ClosedRun, 'runCount' | 'checkpoints'>,
  arcanaCards: readonly string[],
): readonly ProfileGate[] {
  if (run.runCount === 0) return [];
  const start = run.checkpoints[0];
  const progression = start?.profile.progression;
  if (progression === undefined) return PROFILE_GATES;
  const aspect = start!.hero?.slotted['Aspect'];
  const keepsakes = new Set(
    run.checkpoints.flatMap((save) => save.hero?.slotted['Keepsake'] ?? []),
  );
  const familiar = start!.profile.equippedFamiliar;
  const upgrades = new Set(progression.familiarUpgrades);
  const met: Readonly<Record<ProfileGate, boolean>> = {
    trueEnding: progression.reachedTrueEnding,
    arcanaRanks: arcanaCards.every((card) => {
      const rank = progression.arcanaRanks[card];
      return rank !== undefined && rank.unlocked && rank.level >= ARCANA_RANK;
    }),
    aspectRank: aspect !== undefined && (progression.aspectRanks[aspect] ?? 1) >= ASPECT_RANK,
    keepsakeRanks: [...keepsakes].every(
      (keepsake) => (progression.keepsakeChambers[keepsake] ?? 0) >= KEEPSAKE_RANK_III_CHAMBERS,
    ),
    familiarRank:
      familiar === undefined ||
      (FAMILIAR_UPGRADES[familiar]?.every((upgrade) =>
        FAMILIAR_UPGRADE_LEVELS.every((level) => upgrades.has(`${upgrade}${level}`)),
      ) ??
        false),
    autoHarvestOnExit: progression.autoHarvestOnExit,
  };
  return PROFILE_GATES.filter((gate) => !met[gate]);
}

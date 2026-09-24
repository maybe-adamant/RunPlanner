import type { AuthoredGeneratedEncounterCustomization } from '../../authored-project/model';
import type { EncounterEnemyChoice, GeneratedEncounterSelection } from '../../catalog-schema';

export interface FangsAssessment {
  readonly rank: number;
  readonly active: boolean;
  readonly eligibleTypeKeys: readonly string[];
  readonly perkKeys: readonly string[];
  readonly eligiblePerkKeys: readonly string[];
  /** The engine-owned next authoring action. `finish` permits the current prefix. */
  readonly next: 'type' | 'perk' | 'finish' | 'unavailable';
  readonly canFinish: boolean;
  readonly issue?: 'blocked' | 'typeUnavailable' | 'perkUnavailable' | 'incomplete';
}

/** Native Fangs chooses one deduplicated IsElite spawn from the reached composition. */
export function assessFangs(
  policy: GeneratedEncounterSelection,
  authored: AuthoredGeneratedEncounterCustomization,
  rank: number,
  roomSetKey: string | undefined,
  /** Exact resolved generated members; an empty array is a known empty composition. */
  composedKeys: readonly string[],
): FangsAssessment {
  const composed = new Set<string>([
    ...policy.fixedEnemies.map((entry) => entry.key),
    ...composedKeys,
  ]);
  const candidates: EncounterEnemyChoice[] = policy.choices.filter(
    (entry) => composed.has(entry.key) && entry.elite && entry.fangs !== undefined,
  );
  for (const fixed of policy.fixedEnemies)
    if (
      fixed.elite &&
      fixed.fangs !== undefined &&
      !candidates.some((entry) => entry.key === fixed.key)
    )
      candidates.push(fixed);
  const selected = candidates.find((entry) => entry.key === authored.fangs?.typeKey);
  const effectiveRank = Math.max(0, Math.min(2, rank));
  const active = effectiveRank > 0;
  const options =
    selected?.fangs?.options.filter(
      (option) =>
        !selected.fangs!.blockedOptions.includes(option) &&
        (policy.fangs?.perks[option]?.roomSets === undefined ||
          policy.fangs.perks[option].roomSets.includes(roomSetKey ?? '')),
    ) ?? [];
  const selectedPerks = authored.fangs?.perkKeys ?? [];
  const perks = policy.fangs?.perks ?? {};
  // PickEliteAttributes removes the selected value and its directed successors
  // after each draw. Mirror that ordered native bag, rather than accepting a
  // set of pairwise-compatible values.
  let remaining = [...options];
  let validPrefixLength = 0;
  for (const perk of selectedPerks) {
    if (validPrefixLength >= effectiveRank || !remaining.includes(perk)) break;
    validPrefixLength += 1;
    remaining = remaining.filter(
      (option) => option !== perk && !perks[perk]?.excludes.includes(option),
    );
  }
  const validPerks = validPrefixLength === selectedPerks.length;
  const complete =
    selected !== undefined &&
    validPerks &&
    (selectedPerks.length >= effectiveRank || remaining.length === 0);
  const issue =
    !active || authored.fangs === undefined
      ? undefined
      : policy.blockFangsAttributes
        ? 'blocked'
        : selected === undefined
          ? 'typeUnavailable'
          : !validPerks
            ? 'perkUnavailable'
            : !complete
              ? 'incomplete'
              : undefined;
  const next =
    !active || policy.blockFangsAttributes
      ? 'unavailable'
      : authored.fangs === undefined || selected === undefined
        ? 'type'
        : !validPerks
          ? 'perk'
          : complete
            ? 'finish'
            : 'perk';
  return Object.freeze({
    rank: effectiveRank,
    active,
    eligibleTypeKeys: Object.freeze(
      policy.blockFangsAttributes ? [] : candidates.map((entry) => entry.key),
    ),
    perkKeys: Object.freeze(selectedPerks),
    eligiblePerkKeys: Object.freeze(remaining),
    next,
    canFinish: active && !policy.blockFangsAttributes && selected !== undefined && complete,
    ...(issue === undefined ? {} : { issue }),
  });
}

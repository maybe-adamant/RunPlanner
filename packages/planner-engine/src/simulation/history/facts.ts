import { semanticAddressKey } from '../../authored-project/addresses';
import type { HistoryStateView } from './model';

export interface RecentEncounterPhaseFact {
  readonly profileKey: string;
  readonly phaseKeys: readonly string[];
}

export function projectRecentEncounterPhases(
  view: HistoryStateView,
): readonly RecentEncounterPhaseFact[] {
  const ordered = new Map<string, { readonly profileKey: string; readonly phaseKeys: string[] }>();
  for (const encounter of view.ledgers.encounterStarts) {
    const key = semanticAddressKey(encounter.origin);
    const current = ordered.get(key);
    if (current === undefined) {
      ordered.set(key, {
        profileKey: encounter.encounterProfileKey,
        phaseKeys: [encounter.phaseKey],
      });
    } else {
      current.phaseKeys.push(encounter.phaseKey);
    }
  }
  return Object.freeze(
    [...ordered.values()].map((entry) =>
      Object.freeze({ profileKey: entry.profileKey, phaseKeys: Object.freeze(entry.phaseKeys) }),
    ),
  );
}

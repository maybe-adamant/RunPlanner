import type {
  CatalogCollection,
  EncounterPhase,
  EncounterPhaseKind,
  EncounterProfile,
} from '@run-planner/core';

import type { RawEncounterProfileDeclaration } from '../declarations';
import { createCollection, requireNonEmpty } from './common';
import { fail } from './errors';

const encounterPhaseKinds = new Set<EncounterPhaseKind>([
  'boss',
  'combat',
  'miniboss',
  'nonCombat',
  'story',
]);

export function normalizeEncounterProfiles(
  rawProfiles: readonly RawEncounterProfileDeclaration[],
): CatalogCollection<EncounterProfile> {
  const profiles = rawProfiles.map((profile, profileIndex): EncounterProfile => {
    const path = `encounterProfiles[${profileIndex}]`;
    requireNonEmpty(profile.key, `${path}.key`);
    const seenPhases = new Set<string>();
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
      });
    });

    return Object.freeze({ key: profile.key, phases: Object.freeze(phases) });
  });

  return createCollection(profiles, 'encounterProfiles', (profile) => profile.key);
}

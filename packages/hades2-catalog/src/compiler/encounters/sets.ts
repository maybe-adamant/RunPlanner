import type { CatalogCollection, EncounterSet } from '@run-planner/engine/catalog-schema';

import type { RawEncounterSetDeclaration } from '../../declarations/index';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from '../common';
import { fail } from '../errors';

export function normalizeEncounterSets(
  rawSets: readonly RawEncounterSetDeclaration[],
): CatalogCollection<EncounterSet> {
  return createCollection(
    rawSets.map((raw, setIndex): EncounterSet => {
      const path = `encounterSets[${setIndex}]`;
      const key = requireNonEmpty(raw.key, `${path}.key`);
      const encounterDefinitionKeys = freezeUniqueStrings(
        raw.encounterDefinitionKeys,
        `${path}.encounterDefinitionKeys`,
      );
      if (encounterDefinitionKeys.length === 0) {
        fail(`${path}.encounterDefinitionKeys`, 'must not be empty');
      }
      const defaultAuthoringProfileKey = requireNonEmpty(
        raw.defaultAuthoringProfileKey,
        `${path}.defaultAuthoringProfileKey`,
      );
      if (!encounterDefinitionKeys.includes(defaultAuthoringProfileKey)) {
        fail(`${path}.defaultAuthoringProfileKey`, 'must be a member of the encounter set');
      }
      const authoringProfiles =
        raw.authoringProfiles === undefined
          ? undefined
          : Object.freeze(
              raw.authoringProfiles.map((rawProfile, profileIndex) => {
                const profilePath = `${path}.authoringProfiles[${profileIndex}]`;
                const profileKey = requireNonEmpty(rawProfile.key, `${profilePath}.key`);
                const profileDefinitionKeys = freezeUniqueStrings(
                  rawProfile.encounterDefinitionKeys,
                  `${profilePath}.encounterDefinitionKeys`,
                );
                if (profileDefinitionKeys.length === 0) {
                  fail(`${profilePath}.encounterDefinitionKeys`, 'must not be empty');
                }
                if (!profileDefinitionKeys.includes(profileKey)) {
                  fail(`${profilePath}.key`, 'must identify one exact definition in the profile');
                }
                for (const definitionKey of profileDefinitionKeys) {
                  if (!encounterDefinitionKeys.includes(definitionKey)) {
                    fail(
                      `${profilePath}.encounterDefinitionKeys`,
                      `${definitionKey} is not a member of ${key}`,
                    );
                  }
                }
                return Object.freeze({
                  key: profileKey,
                  encounterDefinitionKeys: profileDefinitionKeys,
                });
              }),
            );
      if (authoringProfiles !== undefined) {
        const profileKeys = authoringProfiles.map((profile) => profile.key);
        if (new Set(profileKeys).size !== profileKeys.length) {
          fail(`${path}.authoringProfiles`, 'must have unique authored keys');
        }
        const profiledDefinitionKeys = authoringProfiles.flatMap(
          (profile) => profile.encounterDefinitionKeys,
        );
        if (
          profiledDefinitionKeys.length !== encounterDefinitionKeys.length ||
          new Set(profiledDefinitionKeys).size !== encounterDefinitionKeys.length ||
          encounterDefinitionKeys.some(
            (definitionKey) => !profiledDefinitionKeys.includes(definitionKey),
          )
        ) {
          fail(`${path}.authoringProfiles`, 'must partition every exact encounter definition once');
        }
        if (!profileKeys.includes(defaultAuthoringProfileKey)) {
          fail(`${path}.defaultAuthoringProfileKey`, 'must identify an authored profile');
        }
      }
      return Object.freeze({
        key,
        encounterDefinitionKeys,
        defaultAuthoringProfileKey,
        ...(authoringProfiles === undefined ? {} : { authoringProfiles }),
      });
    }),
    'encounterSets',
    (set) => set.key,
  );
}

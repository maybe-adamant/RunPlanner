import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterSet,
} from '@run-planner/engine/catalog-schema';

import type { RawEncounterSetDeclaration } from '../../declarations/index';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from '../common';
import { fail } from '../errors';

export function normalizeEncounterSets(
  rawSets: readonly RawEncounterSetDeclaration[],
  definitions: CatalogCollection<EncounterDefinition>,
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
      const rawProfiles =
        raw.authoringProfiles ??
        encounterDefinitionKeys.map((encounterDefinitionKey) => ({
          key: encounterDefinitionKey,
          encounterDefinitionKeys: [encounterDefinitionKey],
          resolution: { kind: 'direct' as const, encounterDefinitionKey },
        }));
      const authoringProfiles = Object.freeze(
        rawProfiles.map((rawProfile, profileIndex) => {
          const profilePath = `${path}.authoringProfiles[${profileIndex}]`;
          const profileKey = requireNonEmpty(rawProfile.key, `${profilePath}.key`);
          const profileDefinitionKeys = freezeUniqueStrings(
            rawProfile.encounterDefinitionKeys,
            `${profilePath}.encounterDefinitionKeys`,
          );
          if (profileDefinitionKeys.length === 0) {
            fail(`${profilePath}.encounterDefinitionKeys`, 'must not be empty');
          }
          for (const definitionKey of profileDefinitionKeys) {
            if (!encounterDefinitionKeys.includes(definitionKey)) {
              fail(
                `${profilePath}.encounterDefinitionKeys`,
                `${definitionKey} is not a member of ${key}`,
              );
            }
          }
          const resolution =
            rawProfile.resolution ??
            (profileDefinitionKeys.length === 1
              ? { kind: 'direct' as const, encounterDefinitionKey: profileDefinitionKeys[0]! }
              : fail(`${profilePath}.resolution`, 'is required for a contextual authored choice'));
          const targets =
            resolution.kind === 'direct'
              ? [resolution.encounterDefinitionKey]
              : [
                  resolution.defaultEncounterDefinitionKey,
                  ...Object.values(resolution.encounterDefinitionKeyByRewardType),
                ];
          if (
            resolution.kind === 'rewardContext' &&
            Object.keys(resolution.encounterDefinitionKeyByRewardType).length === 0
          ) {
            fail(
              `${profilePath}.resolution.encounterDefinitionKeyByRewardType`,
              'must not be empty',
            );
          }
          for (const target of targets) {
            if (!profileDefinitionKeys.includes(target)) {
              fail(`${profilePath}.resolution`, `${target} is not a member of this choice`);
            }
            if (definitions.byKey[target] === undefined) {
              fail(`${profilePath}.resolution`, `unknown encounter definition ${target}`);
            }
          }
          if (
            new Set(targets).size !== profileDefinitionKeys.length ||
            profileDefinitionKeys.some((definitionKey) => !targets.includes(definitionKey))
          ) {
            fail(`${profilePath}.resolution`, 'must resolve every declared member');
          }
          const rawLabel = 'label' in rawProfile ? rawProfile.label : undefined;
          const label =
            rawLabel ??
            (resolution.kind === 'direct'
              ? definitions.byKey[resolution.encounterDefinitionKey]?.label
              : undefined);
          if (label === undefined)
            fail(`${profilePath}.label`, 'requires a declared definition label');
          const kinds = new Set(
            profileDefinitionKeys.map((definitionKey) => definitions.byKey[definitionKey]!.kind),
          );
          if (kinds.size !== 1) {
            fail(
              `${profilePath}.encounterDefinitionKeys`,
              'must share one structural encounter kind',
            );
          }
          return Object.freeze({
            key: profileKey,
            label,
            kind: definitions.byKey[profileDefinitionKeys[0]!]!.kind,
            encounterDefinitionKeys: profileDefinitionKeys,
            resolution: Object.freeze(
              resolution.kind === 'direct'
                ? {
                    kind: 'direct' as const,
                    encounterDefinitionKey: resolution.encounterDefinitionKey,
                  }
                : {
                    kind: 'rewardContext' as const,
                    defaultEncounterDefinitionKey: resolution.defaultEncounterDefinitionKey,
                    encounterDefinitionKeyByRewardType: Object.freeze({
                      ...resolution.encounterDefinitionKeyByRewardType,
                    }),
                  },
            ),
          });
        }),
      );
      {
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
        authoringProfiles,
      });
    }),
    'encounterSets',
    (set) => set.key,
  );
}

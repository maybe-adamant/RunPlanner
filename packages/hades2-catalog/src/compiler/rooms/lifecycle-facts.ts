import type {
  CatalogCollection,
  RoomDeclaration,
  RoomLifecycleProfile,
  RoomLifecycleProfileSelection,
  RoomTemplateKey,
} from '@run-planner/engine/catalog-schema';

import type { RawRoomTemplateLifecycleDeclaration } from '../../declarations/index';
import { fail } from '../errors';

/** The template lifecycles and the profiles they name. */
export interface RoomLifecycleInput {
  readonly templates: Readonly<Record<RoomTemplateKey, RawRoomTemplateLifecycleDeclaration>>;
  readonly derived: RawRoomTemplateLifecycleDeclaration;
  readonly profiles: CatalogCollection<RoomLifecycleProfile>;
}

export type RoomLifecycleFacts = Pick<
  RoomDeclaration,
  'lifecycleProfile' | 'roleLifecycleProfileKeys'
>;

/**
 * The room's lifecycle: its declared specialization, else its template's, a
 * fixed template choosing the one lifecycle that admits the room's envelope.
 */
export function normalizeRoomLifecycleFacts(
  room: Pick<RoomDeclaration, 'mode' | 'lifecycleProfileKey' | 'encounterEnvelopeKey'>,
  input: RoomLifecycleInput,
  path: string,
): RoomLifecycleFacts {
  const requireProfile = (key: string, at: string): string => {
    const profile = input.profiles.byKey[key];
    if (profile === undefined) fail(at, `unknown room lifecycle profile ${key}`);
    if (!profile.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey))
      fail(at, `${key} does not support the room encounter envelope`);
    return key;
  };
  const templatePath =
    room.mode.kind === 'authored'
      ? `roomTemplateLifecycles.${room.mode.templateKey}`
      : 'derivedRoomLifecycle';
  const template =
    room.mode.kind === 'authored' ? input.templates[room.mode.templateKey] : input.derived;
  const selection = ((): RoomLifecycleProfileSelection => {
    if (room.lifecycleProfileKey !== undefined)
      return {
        kind: 'fixed',
        profileKey: requireProfile(room.lifecycleProfileKey, `${path}.lifecycleProfileKey`),
      };
    switch (template.kind) {
      case 'fixed': {
        const admitting = template.profileKeys.filter((key) =>
          input.profiles.byKey[key]?.encounterEnvelopeKeys.includes(room.encounterEnvelopeKey),
        );
        if (admitting.length !== 1)
          fail(
            `${templatePath}.profileKeys`,
            `must name one lifecycle for ${path}'s envelope ${room.encounterEnvelopeKey}`,
          );
        return { kind: 'fixed', profileKey: requireProfile(admitting[0]!, templatePath) };
      }
      case 'prebossOffer':
        return {
          kind: 'prebossOffer',
          shopProfileKey: requireProfile(template.shopProfileKey, templatePath),
          freeRewardProfileKey: requireProfile(template.freeRewardProfileKey, templatePath),
        };
    }
  })();
  const roles = template.kind === 'fixed' ? template.roleProfileKeys : undefined;
  return Object.freeze({
    lifecycleProfile: Object.freeze(selection),
    ...(roles === undefined
      ? {}
      : {
          roleLifecycleProfileKeys: Object.freeze(
            Object.fromEntries(
              Object.entries(roles).map(([role, key]) => [
                role,
                requireProfile(key, `${templatePath}.roleProfileKeys.${role}`),
              ]),
            ),
          ),
        }),
  });
}

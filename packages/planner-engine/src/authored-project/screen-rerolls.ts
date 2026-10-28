import type { Catalog, RoomDeclaration } from '../catalog-schema';
import { expectPositiveInteger, failProjectDocument } from './validation';

/**
 * An offer screen whose final rows the plan authors and whose native reroll
 * button may be pressed first. The flag is the button's presence; a screen
 * with no alternative left still refuses natively.
 */
export type RerollableScreen =
  | { readonly kind: 'traitOffer'; readonly giverKey: string }
  | { readonly kind: 'levelChoice'; readonly rewardType: string }
  | { readonly kind: 'stygianWell'; readonly room: RoomDeclaration }
  | { readonly kind: 'purgingPool'; readonly room: RoomDeclaration };

/** Whether the screen shows the native reroll button. */
export function screenRerollSupported(catalog: Catalog, screen: RerollableScreen): boolean {
  switch (screen.kind) {
    case 'traitOffer':
      return catalog.traitGivers.byKey[screen.giverKey]?.screenReroll === true;
    case 'levelChoice':
      return catalog.rewards.rewardTypes.byKey[screen.rewardType]?.screenReroll === true;
    case 'stygianWell': {
      const profileKey = screen.room.roomShop?.profileKey;
      return (
        profileKey !== undefined && catalog.rewards.shops.byKey[profileKey]?.screenReroll === true
      );
    }
    case 'purgingPool':
      return screen.room.purgingPool?.screenReroll === true;
  }
}

/** The n-th reroll of one screen costs n, so k rerolls cost k(k+1)/2. */
export function screenRerollCost(count: number): number {
  return (count * (count + 1)) / 2;
}

/** A persisted screen reroll count: absent is none, so a present count is positive. */
export function decodeScreenRerollCount(
  record: Readonly<Record<string, unknown>>,
  supported: boolean,
  path: string,
): number | undefined {
  if (!Object.hasOwn(record, 'rerollCount')) return undefined;
  const count = expectPositiveInteger(record.rerollCount, `${path}.rerollCount`);
  if (!supported) failProjectDocument(`${path}.rerollCount`, 'this screen cannot be rerolled');
  return count;
}

/** Spreads a screen reroll count only when present. */
export function screenRerollCountField(count: number | undefined): {
  readonly rerollCount?: number;
} {
  return count === undefined || count === 0 ? {} : { rerollCount: count };
}

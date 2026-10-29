import type { Catalog, RoomDeclaration, TraitRarity } from '../catalog-schema';
import {
  normalizeChaosCurseOptions,
  optionIndex,
  TRAIT_OPTION_KEYS,
  traitOfferSupportsExhaustion,
  type AuthoredChaosTraitOffer,
  type AuthoredRerolledChaosScreen,
  type AuthoredRerolledLevelScreen,
  type AuthoredRerolledTraitOption,
  type AuthoredRerolledTraitScreen,
  type AuthoredTraitOfferFallbackGold,
  type AuthoredTraitOfferTraits,
  type RerolledScreens,
  type TraitOptionKey,
} from './traits/state';
import {
  expectArray,
  expectExactKeys,
  expectNonNegativeInteger,
  expectRecord,
  expectString,
  failProjectDocument,
} from './validation';

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

/**
 * Validates one authored earlier trait screen: up to three distinct rows of the
 * giver at a supported rarity; fewer than three only where the giver's pool
 * can run out; the Rejected row names a shown row. Rarify clicks name row keys
 * only; whether a click was possible is the simulation's judgment.
 */
export function normalizeRerolledTraitScreen(
  catalog: Catalog,
  giverKey: string,
  screen: AuthoredRerolledTraitScreen,
): AuthoredRerolledTraitScreen {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) throw new Error(`unknown trait giver ${giverKey}`);
  if (!Array.isArray(screen.options) || screen.options.length > TRAIT_OPTION_KEYS.length)
    throw new Error('a rerolled screen shows at most three options');
  if (!traitOfferSupportsExhaustion(giver) && screen.options.length !== TRAIT_OPTION_KEYS.length)
    throw new Error('this trait giver shows exactly three options');
  if (new Set(screen.options.map((option) => option.traitKey)).size !== screen.options.length)
    throw new Error('rerolled screen trait keys must be distinct');
  const options = screen.options.map((option, index) => {
    const trait = catalog.traits.byKey[option.traitKey];
    if (trait === undefined || !giver.traitKeys.includes(option.traitKey))
      throw new Error(`option${index + 1} ${option.traitKey} is not in giver ${giverKey}`);
    if (trait.rarityDomain.kind === 'none') {
      if (option.rarity !== undefined)
        throw new Error(`rarityless option ${option.traitKey} has no rarity`);
    } else if (
      option.rarity === undefined ||
      !trait.rarityDomain.equippedRarities.includes(option.rarity)
    )
      throw new Error(`unsupported authored rarity for ${option.traitKey}`);
    if (giver.rarityPolicy.kind === 'fixed' && option.rarity !== giver.rarityPolicy.rarity)
      throw new Error(`${option.traitKey} must use fixed rarity ${giver.rarityPolicy.rarity}`);
    const bonus = option.persephoneLevelBonus;
    if (bonus !== undefined && (!Number.isInteger(bonus) || bonus < 0 || bonus > 8))
      throw new Error(`${option.traitKey} Persephone level bonus must be an integer from 0 to 8`);
    return rerolledTraitOption(option);
  });
  const rejected = screen.rejectedOptionKey;
  if (
    rejected !== undefined &&
    (!TRAIT_OPTION_KEYS.includes(rejected) || options[optionIndex(rejected)] === undefined)
  )
    throw new Error('the rejected row must name a shown option');
  const actions = screen.rarificationActions;
  if (
    actions !== undefined &&
    (!Array.isArray(actions) || actions.some((key) => !TRAIT_OPTION_KEYS.includes(key)))
  )
    throw new Error('rarification actions must name trait offer option rows');
  return Object.freeze({
    options: Object.freeze(options),
    ...(rejected === undefined ? {} : { rejectedOptionKey: rejected }),
    ...rarificationActionsField(actions),
  });
}

/** Spreads a Rarify click list only when it holds a click. */
function rarificationActionsField(actions: readonly TraitOptionKey[] | undefined): {
  readonly rarificationActions?: readonly TraitOptionKey[];
} {
  return actions === undefined || actions.length === 0
    ? {}
    : { rarificationActions: Object.freeze([...actions]) };
}

/** Validates one authored earlier Chaos screen. */
export function normalizeRerolledChaosScreen(
  catalog: Catalog,
  screen: AuthoredRerolledChaosScreen,
): AuthoredRerolledChaosScreen {
  return Object.freeze({ curseOptions: normalizeChaosCurseOptions(catalog, screen.curseOptions) });
}

/** Validates one authored earlier Pom level screen: distinct known traits. */
export function normalizeRerolledLevelScreen(
  catalog: Catalog,
  screen: AuthoredRerolledLevelScreen,
): AuthoredRerolledLevelScreen {
  if (!Array.isArray(screen.offeredTraitKeys))
    throw new Error('a rerolled Pom screen lists its offered traits');
  if (new Set(screen.offeredTraitKeys).size !== screen.offeredTraitKeys.length)
    throw new Error('Pom offered trait keys must be distinct');
  for (const key of screen.offeredTraitKeys)
    if (catalog.traits.byKey[key] === undefined) throw new Error(`unknown trait ${key}`);
  return Object.freeze({ offeredTraitKeys: Object.freeze([...screen.offeredTraitKeys]) });
}

/**
 * Validates a complete earlier-screen list for a screen that may or may not be
 * rerolled; an empty list is no rerolls.
 */
export function normalizeRerolledScreens<T>(
  screens: RerolledScreens<T> | undefined,
  supported: boolean,
  normalize: (screen: T) => T,
): RerolledScreens<T> | undefined {
  if (screens === undefined || screens.length === 0) return undefined;
  if (!supported) throw new Error('this screen cannot be rerolled');
  return Object.freeze(screens.map((screen) => (screen === null ? null : normalize(screen))));
}

/** Spreads an earlier-screen list only when it holds a screen. */
export function rerolledScreensField<T>(screens: RerolledScreens<T> | undefined): {
  readonly rerolledScreens?: RerolledScreens<T>;
} {
  return screens === undefined || screens.length === 0 ? {} : { rerolledScreens: screens };
}

/** The screen's reroll count: one per earlier screen. */
export function rerolledScreenCount(value: {
  readonly rerolledScreens?: RerolledScreens<unknown>;
}): number {
  return value.rerolledScreens?.length ?? 0;
}

/**
 * A reroll keeps the screen it rerolls: the final screen's rows are copied to
 * the end of the earlier screens, and the final screen keeps its pick.
 */
export function withScreenRerollInserted<T>(
  screens: RerolledScreens<T> | undefined,
  snapshot: T,
): RerolledScreens<T> {
  return Object.freeze([...(screens ?? []), snapshot]);
}

function rerolledTraitOption(option: AuthoredRerolledTraitOption): AuthoredRerolledTraitOption {
  return Object.freeze({
    traitKey: option.traitKey,
    ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
    ...(option.persephoneLevelBonus === undefined
      ? {}
      : { persephoneLevelBonus: option.persephoneLevelBonus }),
  });
}

/** The shown rows of a final trait screen, as an earlier screen. */
export function rerolledTraitScreenSnapshot(
  offer: Pick<AuthoredTraitOfferTraits, 'options' | 'rejectedOptionKey'>,
): AuthoredRerolledTraitScreen {
  return Object.freeze({
    options: Object.freeze(offer.options.map(rerolledTraitOption)),
    ...(offer.rejectedOptionKey === undefined
      ? {}
      : { rejectedOptionKey: offer.rejectedOptionKey }),
  });
}

/**
 * Rerolls a final trait or Gold screen. The rerolled screen is the same native
 * screen, so its rows and the Rarify clicks made on it move to the end of the
 * earlier screens; the final screen keeps its rows and pick with no click yet.
 */
export function withFinalTraitScreenRerolled(
  offer: AuthoredTraitOfferTraits | AuthoredTraitOfferFallbackGold,
): AuthoredTraitOfferTraits | AuthoredTraitOfferFallbackGold {
  if (offer.kind === 'fallbackGold')
    return Object.freeze({
      ...offer,
      rerolledScreens: withScreenRerollInserted(
        offer.rerolledScreens,
        Object.freeze({ options: Object.freeze([]) }),
      ),
    });
  return Object.freeze({
    ...offer,
    rarificationActions: Object.freeze([]),
    rerolledScreens: withScreenRerollInserted(
      offer.rerolledScreens,
      Object.freeze({
        ...rerolledTraitScreenSnapshot(offer),
        ...rarificationActionsField(offer.rarificationActions),
      }),
    ),
  });
}

/** The shown curses of a final Chaos screen, as an earlier screen. */
export function rerolledChaosScreenSnapshot(
  offer: Pick<AuthoredChaosTraitOffer, 'curseOptions'>,
): AuthoredRerolledChaosScreen {
  return Object.freeze({ curseOptions: offer.curseOptions });
}

/** The shown boons of a final Pom screen, as an earlier screen. */
export function rerolledLevelScreenSnapshot(choice: {
  readonly offeredTraitKeys: readonly string[];
}): AuthoredRerolledLevelScreen {
  return Object.freeze({ offeredTraitKeys: Object.freeze([...choice.offeredTraitKeys]) });
}

/** The screen list after adding or removing rerolls one at a time to reach `count`. */
export function withScreenRerollCount<T>(
  screens: RerolledScreens<T> | undefined,
  count: number,
  snapshot: T,
): RerolledScreens<T> | undefined {
  let next = screens;
  while ((next?.length ?? 0) < count) next = withScreenRerollInserted(next, snapshot);
  while ((next?.length ?? 0) > Math.max(0, count)) next = withScreenRerollRemoved(next);
  return next;
}

/** Removing a reroll drops the earlier screen just before the final one. */
export function withScreenRerollRemoved<T>(
  screens: RerolledScreens<T> | undefined,
): RerolledScreens<T> | undefined {
  if (screens === undefined || screens.length === 0) throw new Error('the screen has no reroll');
  return screens.length === 1 ? undefined : Object.freeze(screens.slice(0, -1));
}

/** Replaces one earlier screen, or clears it back to not yet authored. */
export function withRerolledScreenReplaced<T>(
  screens: RerolledScreens<T> | undefined,
  index: number,
  value: T | null,
): RerolledScreens<T> {
  if (screens === undefined || !Number.isInteger(index) || index < 0 || index >= screens.length)
    throw new Error(`the screen has no rerolled screen ${index}`);
  return Object.freeze(screens.map((screen, at) => (at === index ? value : screen)));
}

/**
 * Decodes a persisted earlier-screen list: absent is none, so a present list
 * holds at least one screen, each null or decoded by its owner.
 */
export function decodeRerolledScreens<T>(
  record: Readonly<Record<string, unknown>>,
  supported: boolean,
  path: string,
  decode: (value: unknown, path: string) => T,
): RerolledScreens<T> | undefined {
  if (!Object.hasOwn(record, 'rerolledScreens')) return undefined;
  const screens = expectArray(record.rerolledScreens, `${path}.rerolledScreens`);
  if (screens.length === 0)
    failProjectDocument(`${path}.rerolledScreens`, 'must hold at least one screen');
  if (!supported) failProjectDocument(`${path}.rerolledScreens`, 'this screen cannot be rerolled');
  return Object.freeze(
    screens.map((screen, index) =>
      screen === null ? null : decode(screen, `${path}.rerolledScreens[${index}]`),
    ),
  );
}

/** Decodes one earlier trait screen strictly. */
export function decodeRerolledTraitScreen(
  catalog: Catalog,
  giverKey: string,
  value: unknown,
  path: string,
): AuthoredRerolledTraitScreen {
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'options',
      ...(Object.hasOwn(record, 'rejectedOptionKey') ? ['rejectedOptionKey'] : []),
      ...(Object.hasOwn(record, 'rarificationActions') ? ['rarificationActions'] : []),
    ],
    path,
  );
  const options = expectArray(record.options, `${path}.options`).map((raw, index) => {
    const optionPath = `${path}.options[${index}]`;
    const option = expectRecord(raw, optionPath);
    expectExactKeys(
      option,
      [
        'traitKey',
        ...(Object.hasOwn(option, 'rarity') ? ['rarity'] : []),
        ...(Object.hasOwn(option, 'persephoneLevelBonus') ? ['persephoneLevelBonus'] : []),
      ],
      optionPath,
    );
    const traitKey = expectString(option.traitKey, `${optionPath}.traitKey`);
    return {
      traitKey,
      ...(Object.hasOwn(option, 'rarity')
        ? { rarity: expectString(option.rarity, `${optionPath}.rarity`) as TraitRarity }
        : {}),
      ...(Object.hasOwn(option, 'persephoneLevelBonus')
        ? {
            persephoneLevelBonus: expectNonNegativeInteger(
              option.persephoneLevelBonus,
              `${optionPath}.persephoneLevelBonus`,
            ),
          }
        : {}),
    };
  });
  const rejected = Object.hasOwn(record, 'rejectedOptionKey')
    ? (expectString(record.rejectedOptionKey, `${path}.rejectedOptionKey`) as TraitOptionKey)
    : undefined;
  // Absent is none, so a present list holds at least one click.
  const actions = Object.hasOwn(record, 'rarificationActions')
    ? expectArray(record.rarificationActions, `${path}.rarificationActions`).map((value, index) => {
        const key = expectString(value, `${path}.rarificationActions[${index}]`);
        if (!(TRAIT_OPTION_KEYS as readonly string[]).includes(key))
          failProjectDocument(`${path}.rarificationActions[${index}]`, 'must name an option row');
        return key as TraitOptionKey;
      })
    : undefined;
  if (actions !== undefined && actions.length === 0)
    failProjectDocument(`${path}.rarificationActions`, 'must hold at least one click');
  try {
    return normalizeRerolledTraitScreen(catalog, giverKey, {
      options,
      ...(rejected === undefined ? {} : { rejectedOptionKey: rejected }),
      ...(actions === undefined ? {} : { rarificationActions: actions }),
    });
  } catch (error) {
    return failProjectDocument(path, error instanceof Error ? error.message : 'invalid screen');
  }
}

/** Decodes one earlier Chaos screen strictly. */
export function decodeRerolledChaosScreen(
  catalog: Catalog,
  value: unknown,
  path: string,
): AuthoredRerolledChaosScreen {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['curseOptions'], path);
  const curseOptions = expectArray(record.curseOptions, `${path}.curseOptions`).map(
    (raw, index) => {
      const optionPath = `${path}.curseOptions[${index}]`;
      const option = expectRecord(raw, optionPath);
      expectExactKeys(option, ['curseKey', 'requirementCount'], optionPath);
      return {
        curseKey: expectString(option.curseKey, `${optionPath}.curseKey`),
        requirementCount:
          typeof option.requirementCount === 'number'
            ? option.requirementCount
            : failProjectDocument(`${optionPath}.requirementCount`, 'must be a number'),
      };
    },
  );
  try {
    return Object.freeze({ curseOptions: normalizeChaosCurseOptions(catalog, curseOptions) });
  } catch (error) {
    return failProjectDocument(path, error instanceof Error ? error.message : 'invalid screen');
  }
}

/** Decodes one earlier Pom level screen strictly. */
export function decodeRerolledLevelScreen(
  catalog: Catalog,
  value: unknown,
  path: string,
): AuthoredRerolledLevelScreen {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['offeredTraitKeys'], path);
  const keys = expectArray(record.offeredTraitKeys, `${path}.offeredTraitKeys`).map((key, index) =>
    expectString(key, `${path}.offeredTraitKeys[${index}]`),
  );
  try {
    return normalizeRerolledLevelScreen(catalog, { offeredTraitKeys: keys });
  } catch (error) {
    return failProjectDocument(path, error instanceof Error ? error.message : 'invalid screen');
  }
}

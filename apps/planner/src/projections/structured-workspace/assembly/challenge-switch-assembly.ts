import {
  createRoomFeatureAddress,
  semanticAddressKey,
  type OccurrenceAddress,
  type RoomOccurrence,
} from '@run-planner/engine/authored-project';
import type { Catalog, ChallengeSwitchKind } from '@run-planner/engine/catalog-schema';
import {
  eliteChallengeAttributeOptions,
  encounterCompositionView,
  type ChallengeSwitchInteraction,
} from '@run-planner/engine/simulation';
import { generatedEnemyLabel } from '@planner/projections/encounterIssueCopy';

import type {
  WorkspaceChallengeSwitch,
  WorkspaceChallengeSwitchElite,
  WorkspaceChallengeSwitchEncounter,
  WorkspaceChallengeSwitchKindRow,
  WorkspaceChallengeSwitchLock,
} from '../contracts/features';
import type { WorkspaceMarkerDestinationEmitter } from '../navigation/marker-builder';
import { projectEncounterComposition } from '../interactions/generated-encounter-projection';
import { projectEncounterCustomizationDecision } from './occurrence-reward-assembly';

/** The Overview row order: Perfect Clear, Gold, then Elite. */
const kindOrder: readonly ChallengeSwitchKind[] = ['perfectClear', 'time', 'elite'];

const kindLabels: Readonly<Record<ChallengeSwitchKind, string>> = Object.freeze({
  perfectClear: 'Perfect Clear Switch',
  time: 'Gold Switch',
  elite: 'Elite Enemy Switch',
});

/** A switch kind's name in the editor. */
export function challengeSwitchKindLabel(kind: ChallengeSwitchKind): string {
  return kindLabels[kind];
}

/** The observed switch's kind, when its variant is declared. */
export function observedChallengeSwitchKind(
  catalog: Catalog,
  occurrence:
    Pick<RoomOccurrence, 'challengeSwitch'> | Partial<Pick<RoomOccurrence, 'challengeSwitch'>>,
): ChallengeSwitchKind | undefined {
  const variantKey = occurrence.challengeSwitch?.variantKey;
  return variantKey === undefined
    ? undefined
    : catalog.challengeSwitches.variants.byKey[variantKey]?.switchKind;
}

function variantLock(
  product: ChallengeSwitchInteraction | undefined,
  variantKey: string,
): WorkspaceChallengeSwitchLock | undefined {
  if (product === undefined) return Object.freeze({ reason: 'unreached' as const });
  const shared = product.sharedIssues[0];
  if (shared !== undefined) return shared;
  const variant = product.variants.find((candidate) => candidate.variantKey === variantKey);
  switch (variant?.lock) {
    case undefined:
      return undefined;
    case 'kindUnavailable':
      return Object.freeze({ reason: 'kindUnavailable' as const, switchKind: variant.switchKind });
    case 'variantUnavailable':
      return Object.freeze({ reason: 'variantUnavailable' as const, variantKey });
  }
}

function eliteProduct(
  catalog: Catalog,
  product: ChallengeSwitchInteraction,
  occurrence: RoomOccurrence,
): WorkspaceChallengeSwitchElite | undefined {
  const declaration = catalog.challengeSwitches.eliteEncounters.byKey[product.elite.encounterKey];
  if (declaration === undefined) return undefined;
  const pinned = occurrence.challengeSwitch?.elite;
  const labelOf = (key: string) => product.elite.attributeLabels[key] ?? key;
  const enemies = product.elite.enemies.map((enemy) =>
    Object.freeze({ key: enemy.enemyKey, label: generatedEnemyLabel(enemy.label) }),
  );
  const enemy = enemies.find((candidate) => candidate.key === pinned?.enemyKey);
  return Object.freeze({
    enemies: Object.freeze(enemies),
    ...(pinned === undefined ? {} : { enemyKey: pinned.enemyKey }),
    ...(enemy === undefined ? {} : { enemyLabel: enemy.label }),
    attributes: Object.freeze(
      Array.from({ length: product.elite.attributeCount }, (_, index) => {
        const key = pinned?.attributeKeys[index];
        // A draw after an unpinned one, or of an unpinned elite, stays native.
        const choices =
          pinned === undefined || index > pinned.attributeKeys.length
            ? []
            : eliteChallengeAttributeOptions(
                declaration,
                pinned.enemyKey,
                product.elite.roomSetKey,
                pinned.attributeKeys.slice(0, index),
              );
        return Object.freeze({
          ...(key === undefined ? {} : { key, label: labelOf(key) }),
          choices: Object.freeze(
            choices.map((choice) => Object.freeze({ key: choice, label: labelOf(choice) })),
          ),
        });
      }),
    ),
  });
}

function encounterProduct(
  catalog: Catalog,
  product: ChallengeSwitchInteraction,
  gameName: string,
): WorkspaceChallengeSwitchEncounter | undefined {
  const encounter = product.encounter;
  if (encounter === undefined) return undefined;
  const view = encounterCompositionView(catalog, encounter);
  return Object.freeze({
    definitionKey: encounter.selectedEncounterDefinitionKey,
    label: encounter.label,
    ...(encounter.customization.length === 0
      ? {}
      : {
          customization: Object.freeze(
            encounter.customization.map((decision) =>
              projectEncounterCustomizationDecision(decision, gameName),
            ),
          ),
        }),
    ...(view === undefined ? {} : { composition: projectEncounterComposition(view) }),
  });
}

/**
 * A switch host's Overview rows: each kind with the variants its entry can
 * roll, as the engine's variant query assesses them, and the observed
 * switch's encounter. Absent for a room that cannot host a switch.
 */
export function assembleChallengeSwitch(input: {
  readonly catalog: Catalog;
  readonly occurrence: RoomOccurrence;
  readonly address: OccurrenceAddress;
  readonly markerDestinations: WorkspaceMarkerDestinationEmitter;
  /** The engine's variant query at the host's entry; undefined while unreached. */
  readonly product: ChallengeSwitchInteraction | undefined;
}): WorkspaceChallengeSwitch | undefined {
  const { catalog, occurrence, product } = input;
  if (catalog.challengeSwitches.hosts.byKey[occurrence.gameName] === undefined) return undefined;
  const address = createRoomFeatureAddress(input.address, { kind: 'challengeSwitch' });
  const observed = occurrence.challengeSwitch?.variantKey;
  const observedKind = observedChallengeSwitchKind(catalog, occurrence);
  const kinds = kindOrder.flatMap((kind): WorkspaceChallengeSwitchKindRow[] => {
    const declaration = catalog.challengeSwitches.kinds.byKey[kind];
    if (declaration === undefined) return [];
    const variants = catalog.challengeSwitches.variants.values
      .filter((variant) => variant.switchKind === kind)
      .map((variant) => {
        const lock = variantLock(product, variant.key);
        return Object.freeze({
          variantKey: variant.key,
          rewardType: variant.rewardType,
          label: catalog.rewards.rewardTypes.byKey[variant.rewardType]?.label ?? variant.rewardType,
          selected: variant.key === observed,
          ...(lock === undefined ? {} : { lock }),
        });
      });
    const rollable = variants.filter((variant) => variant.lock === undefined);
    const observeVariantKey =
      rollable.find((variant) => variant.variantKey === declaration.defaultVariantKey)
        ?.variantKey ?? rollable[0]?.variantKey;
    const lock = rollable.length === 0 ? variants[0]?.lock : undefined;
    return [
      Object.freeze({
        kind,
        label: challengeSwitchKindLabel(kind),
        selected: kind === observedKind,
        ...(observeVariantKey === undefined ? {} : { observeVariantKey }),
        ...(lock === undefined ? {} : { lock }),
        variants: Object.freeze(variants),
      }),
    ];
  });
  const encounter =
    product === undefined || observedKind === undefined || observedKind === 'elite'
      ? undefined
      : encounterProduct(catalog, product, occurrence.gameName);
  const elite =
    product === undefined || observedKind !== 'elite'
      ? undefined
      : eliteProduct(catalog, product, occurrence);
  return Object.freeze({
    address,
    marker: input.markerDestinations.marker(address),
    interactionKey: semanticAddressKey(address),
    kinds: Object.freeze(kinds),
    ...(encounter === undefined ? {} : { encounter }),
    ...(elite === undefined ? {} : { elite }),
  });
}

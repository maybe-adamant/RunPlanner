import type { Catalog, TraitElement, TraitRarity } from '../../../catalog-schema';
import { semanticAddressKey } from '../../../authored-project/addresses';
import { optionIndex, type EquippedTrait } from '../../../authored-project/traits/state';
import type { RewardHistoryState } from '../../../reward-kernel/model';
import type {
  ChaosBlessingInstance,
  ChaosCurseInstance,
  TraitHistoryEvent,
  TraitHistoryState,
  TraitOfferEvent,
} from './model';
import { isLevelBearingTrait, isPomUpgradeTarget, nextRarity } from './upgrades';

export function isTraitOfferMutationEvent(event: TraitHistoryEvent): boolean {
  switch (event.kind) {
    case 'traitOffer':
    case 'concaveStoneSecondary':
    case 'levelMutation':
    case 'rarityMutation':
    case 'elementContribution':
    case 'directTraitGrant':
    case 'traitRemoval':
    case 'anvilTransformation':
    case 'chaosPair':
    case 'directChaosBlessing':
    case 'directChaosBlessingRemoval':
    case 'chaosClock':
      return true;
    case 'steadyGrowthProgress':
    case 'pickupProducerProgress':
    case 'echoKeepsakeReplay':
      return false;
  }
}

const emptyElements = Object.freeze({ Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 });
const BASE_ELEMENTS: readonly TraitElement[] = Object.freeze(['Earth', 'Air', 'Fire', 'Water']);
const ORDINARY_EQUIPMENT_SLOTS = new Set(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana']);

function combinedElementFacts(
  fromTraits: ReturnType<typeof deriveFacts>,
  pickupElements: Readonly<Record<TraitElement, number>>,
) {
  const elementCounts = Object.freeze({
    Aether: fromTraits.elementCounts.Aether + pickupElements.Aether,
    Earth: fromTraits.elementCounts.Earth + pickupElements.Earth,
    Air: fromTraits.elementCounts.Air + pickupElements.Air,
    Fire: fromTraits.elementCounts.Fire + pickupElements.Fire,
    Water: fromTraits.elementCounts.Water + pickupElements.Water,
  });
  return Object.freeze({
    ...fromTraits,
    elementCounts,
    highestBaseElementCount: Math.max(...BASE_ELEMENTS.map((element) => elementCounts[element])),
  });
}

export function createTraitHistoryState(): TraitHistoryState {
  return Object.freeze({
    events: Object.freeze([]),
    equippedTraits: Object.freeze({}),
    equippedSlots: Object.freeze({}),
    elementCounts: emptyElements,
    highestBaseElementCount: 0,
    godBoonRarityCounts: Object.freeze({}),
    upgradableTraitCount: 0,
    bannedTraitKeys: Object.freeze([]),
    previouslyPickedTraitKeys: Object.freeze([]),
    activeChaosCurses: Object.freeze([]),
    maturedChaosBlessings: Object.freeze([]),
  });
}

function deriveFacts(catalog: Catalog, equippedTraits: Readonly<Record<string, EquippedTrait>>) {
  const elements: Record<TraitElement, number> = { Aether: 0, Earth: 0, Air: 0, Fire: 0, Water: 0 };
  const slots: Record<string, EquippedTrait> = {};
  const rarityCounts: Record<string, number> = {};
  let upgradable = 0;
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    if (declaration === undefined) continue;
    for (const [element, amount] of Object.entries(declaration.elementContributions)) {
      if (amount !== undefined) elements[element as TraitElement] += amount;
    }
    if (declaration.equipmentSlot !== undefined) slots[declaration.equipmentSlot] = equipped;
    if (
      declaration.usesBoonRarity &&
      equipped.rarity !== undefined &&
      !declaration.excludeFromRarityCount
    ) {
      rarityCounts[equipped.rarity] = (rarityCounts[equipped.rarity] ?? 0) + 1;
    }
    if (isPomUpgradeTarget(catalog, equipped)) upgradable += 1;
  }
  const highestBaseElementCount = Math.max(
    elements.Earth,
    elements.Air,
    elements.Fire,
    elements.Water,
  );
  return Object.freeze({
    equippedSlots: Object.freeze(slots),
    elementCounts: Object.freeze(elements),
    highestBaseElementCount,
    godBoonRarityCounts: Object.freeze(rarityCounts),
    upgradableTraitCount: upgradable,
  });
}

/** The ordinary five-slot view is derived from the one complete equipment ledger. */
export function ordinaryEquippedSlots(
  history: TraitHistoryState,
): Readonly<Record<string, EquippedTrait>> {
  return Object.freeze(
    Object.fromEntries(
      Object.entries(history.equippedSlots).filter(([slot]) => ORDINARY_EQUIPMENT_SLOTS.has(slot)),
    ),
  );
}

function activeRarityFloorSources(
  catalog: Catalog,
  equippedTraits: Readonly<Record<string, EquippedTrait>>,
  elementCounts: Readonly<Record<TraitElement, number>>,
): ReadonlySet<string> {
  const active = new Set<string>();
  for (const equipped of Object.values(equippedTraits)) {
    const declaration = catalog.traits.byKey[equipped.traitKey];
    const effect = declaration?.rarityFloorEffect;
    if (effect === undefined) continue;
    const activeForLedger = Object.entries(effect.activationElementMinimums).every(
      ([element, minimum]) => (elementCounts[element as TraitElement] ?? 0) >= minimum,
    );
    if (activeForLedger) active.add(equipped.traitKey);
  }
  return active;
}

function withRarityAndSteadyGrowthCredit(
  catalog: Catalog,
  trait: EquippedTrait,
  rarity: TraitRarity,
  resetSteadyGrowthProgress = false,
): EquippedTrait {
  const disposition = catalog.traits.byKey[trait.traitKey]?.selectedDisposition;
  if (disposition?.kind !== 'steadyGrowth' || trait.rarity === undefined)
    return Object.freeze({ ...trait, rarity });
  const oldInterval = disposition.intervalsByRarity[trait.rarity as 'Common'];
  const newInterval = disposition.intervalsByRarity[rarity as 'Common'];
  if (oldInterval === undefined || newInterval === undefined)
    return Object.freeze({ ...trait, rarity });
  const progress = resetSteadyGrowthProgress
    ? 0
    : newInterval - Math.min(oldInterval - (trait.steadyGrowthProgress ?? 0), newInterval);
  return Object.freeze({ ...trait, rarity, steadyGrowthProgress: progress });
}

function promoteActiveFloorTargets(
  catalog: Catalog,
  equippedTraits: Record<string, EquippedTrait>,
  activeSources: ReadonlySet<string>,
  events: readonly TraitOfferEvent[],
): void {
  if (activeSources.size === 0) return;
  const effects = [...activeSources].flatMap((sourceKey) => {
    const declaration = catalog.traits.byKey[sourceKey];
    return declaration?.rarityFloorEffect === undefined
      ? []
      : [{ sourceKey, effect: declaration.rarityFloorEffect }];
  });
  if (effects.length === 0) return;
  const promotedKeys: string[] = [];
  for (const [traitKey, equipped] of Object.entries(equippedTraits)) {
    const declaration = catalog.traits.byKey[traitKey];
    if (
      declaration === undefined ||
      !declaration.usesBoonRarity ||
      declaration.blockInRunRarify ||
      activeSources.has(traitKey) ||
      declaration.rarityDomain.kind !== 'ranked' ||
      !declaration.rarityDomain.equippedRarities.includes('Rare') ||
      equipped.rarity !== 'Common' ||
      effects.every(
        ({ effect }) => effect.fromRarity !== 'Common' || effect.minimumRarity !== 'Rare',
      )
    )
      continue;
    equippedTraits[traitKey] = withRarityAndSteadyGrowthCredit(catalog, equipped, 'Rare');
    promotedKeys.push(traitKey);
  }
  // UpgradeAllCommon assigns its source rarity separately, even if it was Epic.
  for (const { sourceKey, effect } of effects) {
    equippedTraits[sourceKey] = Object.freeze({
      ...equippedTraits[sourceKey]!,
      rarity: effect.minimumRarity,
    });
  }
  for (const event of events) {
    const transition = event.targetedAcquisitionTransition;
    if (
      transition?.kind !== 'promoteGodTraitToHeroic' ||
      !promotedKeys.includes(transition.sourceTraitKey)
    )
      continue;
    const target = equippedTraits[transition.targetTraitKey];
    if (target?.level === undefined) continue;
    equippedTraits[transition.targetTraitKey] = Object.freeze({
      ...target,
      level: target.level + 1,
    });
  }
}

export function foldTraitHistoryEvents(
  catalog: Catalog,
  events: readonly TraitHistoryEvent[],
): TraitHistoryState {
  const equipped: Record<string, EquippedTrait> = {};
  const bannedTraitKeys = new Set<string>();
  const previouslyPickedTraitKeys = new Set<string>();
  const pickupElements: Record<TraitElement, number> = {
    Aether: 0,
    Earth: 0,
    Air: 0,
    Fire: 0,
    Water: 0,
  };
  let activeSources: ReadonlySet<string> = new Set();
  let activeChaos: ChaosCurseInstance[] = [];
  const maturedChaos: ChaosBlessingInstance[] = [];
  // Stable ordering retains the producer/purchase chronology already encoded
  // by construction. A targeted acquisition appends its mutation immediately
  // after its own offer, so no global same-sequence reordering is required.
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (let index = 0; index < ordered.length;) {
    const sequence = ordered[index]!.sequence;
    const group: TraitHistoryEvent[] = [];
    while (ordered[index]?.sequence === sequence) group.push(ordered[index++]!);
    for (const event of group) {
      if (event.kind === 'directChaosBlessing') {
        const blessing = catalog.chaos.blessings.byKey[event.blessingKey];
        if (blessing === undefined) continue;
        maturedChaos.push(
          Object.freeze({
            acquisitionIdentity: event.acquisitionIdentity,
            blessingKey: event.blessingKey,
            rarity: event.rarity,
            blessingValues: event.blessingValues,
          }),
        );
        const outcome = blessing.derivedOutcome;
        if (outcome?.kind === 'creation')
          for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
            pickupElements[element] += outcome.elementsPerElementByRarity[event.rarity];
        continue;
      }
      if (event.kind === 'directChaosBlessingRemoval') {
        const index = maturedChaos.findIndex(
          (blessing) => blessing.acquisitionIdentity === event.acquisitionIdentity,
        );
        if (index < 0) continue;
        const [removed] = maturedChaos.splice(index, 1);
        const outcome = catalog.chaos.blessings.byKey[removed!.blessingKey]?.derivedOutcome;
        if (outcome?.kind === 'creation')
          for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
            pickupElements[element] -=
              outcome.elementsPerElementByRarity[
                removed!.rarity === 'Legendary' ? 'Heroic' : removed!.rarity
              ];
        continue;
      }
      if (event.kind === 'chaosPair') {
        for (const curseKey of event.bannedCurseKeys ?? []) bannedTraitKeys.add(curseKey);
        const selectedOption = event.offer.curseOptions[optionIndex(event.offer.selectedOptionKey)];
        const curseKey = selectedOption?.curseKey;
        const curse = curseKey === undefined ? undefined : catalog.chaos.curses.byKey[curseKey];
        if (curse !== undefined)
          activeChaos = [
            ...activeChaos,
            Object.freeze({
              acquisitionIdentity: event.acquisitionIdentity,
              owner: event.owner,
              curseKey,
              duration: selectedOption.requirementCount,
              remaining: selectedOption.requirementCount,
              clock: curse.clock,
              ...(curse.semanticTag === undefined ? {} : { semanticTag: curse.semanticTag }),
              curseValues: event.offer.selectedCurseValues,
              blessingKey: event.offer.blessingKey,
              rarity: event.offer.rarity,
              blessingValues: event.offer.blessingValues,
            }),
          ];
        continue;
      }
      if (event.kind === 'chaosClock') {
        const survivors: ChaosCurseInstance[] = [];
        for (const active of activeChaos) {
          if (active.clock !== event.clock) {
            survivors.push(active);
            continue;
          }
          const remaining = active.remaining - 1;
          if (remaining > 0) {
            survivors.push(Object.freeze({ ...active, remaining }));
            continue;
          }
          maturedChaos.push(
            Object.freeze({
              acquisitionIdentity: active.acquisitionIdentity,
              blessingKey: active.blessingKey,
              rarity: active.rarity,
              blessingValues: active.blessingValues,
            }),
          );
          const outcome = catalog.chaos.blessings.byKey[active.blessingKey]?.derivedOutcome;
          if (outcome?.kind === 'creation')
            for (const element of ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const)
              pickupElements[element] +=
                outcome.elementsPerElementByRarity[
                  active.rarity === 'Legendary' ? 'Heroic' : active.rarity
                ];
        }
        activeChaos = survivors;
        continue;
      }
      if (event.kind === 'levelMutation') {
        const target = equipped[event.targetTraitKey];
        if (
          target !== undefined &&
          target.level === event.oldLevel &&
          event.newLevel > event.oldLevel &&
          isLevelBearingTrait(catalog, event.targetTraitKey)
        ) {
          equipped[event.targetTraitKey] = Object.freeze({ ...target, level: event.newLevel });
        }
        continue;
      }
      if (event.kind === 'steadyGrowthProgress') {
        const target = equipped[event.traitKey];
        if (
          target?.acquisitionIdentity === event.acquisitionIdentity &&
          (target.steadyGrowthProgress ?? 0) === event.oldProgress &&
          event.newProgress >= 0 &&
          event.newProgress < event.requiredInterval
        )
          equipped[event.traitKey] = Object.freeze({
            ...target,
            steadyGrowthProgress: event.newProgress,
          });
        continue;
      }
      if (event.kind === 'pickupProducerProgress') {
        const target = equipped[event.traitKey];
        if (
          target?.acquisitionIdentity === event.acquisitionIdentity &&
          (target.pickupProducerProgress ?? 0) === event.oldProgress &&
          event.newProgress >= 0 &&
          event.newProgress < event.requiredInterval
        )
          equipped[event.traitKey] = Object.freeze({
            ...target,
            pickupProducerProgress: event.newProgress,
          });
        continue;
      }
      if (event.kind === 'rarityMutation') {
        const target = equipped[event.targetTraitKey];
        const directFountainPromotion =
          event.acquisitionRole === 'fountainRarity' &&
          event.acquisitionPoint === 'fountainUsed' &&
          event.oldRarity === 'Common' &&
          event.newRarity === 'Heroic';
        if (
          target?.rarity === event.oldRarity &&
          (directFountainPromotion ||
            nextRarity(catalog, event.targetTraitKey, event.oldRarity) === event.newRarity)
        )
          equipped[event.targetTraitKey] = withRarityAndSteadyGrowthCredit(
            catalog,
            target,
            event.newRarity,
            event.resetSteadyGrowthProgress === true,
          );
        continue;
      }
      if (event.kind === 'elementContribution') {
        for (const [element, value] of Object.entries(event.contributions)) {
          pickupElements[element as TraitElement] += value ?? 0;
        }
        continue;
      }
      if (event.kind === 'traitRemoval') {
        if (
          event.match === 'currentTraitKey' ||
          equipped[event.traitKey]?.acquisitionIdentity === event.acquisitionIdentity
        )
          delete equipped[event.traitKey];
        continue;
      }
      if (event.kind === 'anvilTransformation') {
        if (event.removedTraitKey !== null) {
          const removed = equipped[event.removedTraitKey];
          if (
            removed !== undefined &&
            catalog.traits.byKey[event.removedTraitKey]?.hammerCompatibility !== undefined
          )
            delete equipped[event.removedTraitKey];
        }
        for (const traitKey of event.addedTraitKeys) {
          const declaration = catalog.traits.byKey[traitKey];
          if (declaration?.hammerCompatibility === undefined || equipped[traitKey] !== undefined)
            continue;
          const giver = catalog.traitGivers.byKey.WeaponUpgrade;
          if (giver === undefined || !giver.traitKeys.includes(traitKey)) continue;
          equipped[traitKey] = Object.freeze({
            traitKey,
            giverKey: giver.key,
            providerKind: giver.providerKind,
            hammerRank: 'RankI' as const,
            sourceRole: event.acquisitionRole,
            acquisitionIdentity: `${semanticAddressKey(event.owner)}:${event.sequence}:${traitKey}`,
          });
        }
        continue;
      }
      if (event.kind === 'echoKeepsakeReplay') {
        const gift = equipped[event.traitKey];
        if (
          gift?.acquisitionIdentity === event.acquisitionIdentity &&
          gift.echoRepeatedKeepsakeKey === event.capturedKeepsakeKey
        )
          equipped[event.traitKey] = Object.freeze({
            ...gift,
            echoKeepsakeReplayCount: (gift.echoKeepsakeReplayCount ?? 0) + 1,
          });
        continue;
      }
      if (event.kind === 'directTraitGrant') {
        if (equipped[event.traitKey] !== undefined) continue;
        const giver =
          event.giverKey === undefined ? undefined : catalog.traitGivers.byKey[event.giverKey];
        const declaration = catalog.traits.byKey[event.traitKey];
        const linkedAspectGrant = catalog.aspects.byKey[event.sourceTraitKey]?.startingTrait;
        if (
          declaration === undefined ||
          (event.giverKey !== undefined &&
            (giver === undefined ||
              (!giver.traitKeys.includes(event.traitKey) &&
                (linkedAspectGrant?.traitKey !== event.traitKey ||
                  linkedAspectGrant.giverKey !== event.giverKey))))
        )
          continue;
        equipped[event.traitKey] = Object.freeze({
          traitKey: event.traitKey,
          giverKey: giver?.key ?? event.sourceTraitKey,
          providerKind: giver?.providerKind ?? 'npc',
          ...(isLevelBearingTrait(catalog, event.traitKey) ? { level: 1 } : {}),
          sourceRole: event.acquisitionRole,
        });
        continue;
      }
      if (event.kind !== 'traitOffer' && event.kind !== 'concaveStoneSecondary') continue;
      const option = event.options[optionIndex(event.selectedOptionKey)];
      for (const traitKey of event.bannedTraitKeys ?? []) bannedTraitKeys.add(traitKey);
      if (option !== undefined) previouslyPickedTraitKeys.add(option.traitKey);
      if (option === undefined || equipped[option.traitKey] !== undefined) continue;
      const giver = catalog.traitGivers.byKey[event.giverKey];
      const declaration = catalog.traits.byKey[option.traitKey];
      if (giver === undefined || declaration === undefined) continue;
      // A malformed history must never accumulate two simultaneous traits in
      // one declaration-owned equipment slot. Normal eligibility reports the
      // invalid second offer earlier; this is the final fold attestation.
      if (
        event.replacementTransition === undefined &&
        declaration.equipmentSlot === 'Spell' &&
        Object.values(equipped).some(
          (existing) => catalog.traits.byKey[existing.traitKey]?.equipmentSlot === 'Spell',
        )
      )
        continue;
      const replacementLevel =
        event.replacementTransition === undefined
          ? undefined
          : equipped[event.replacementTransition.replacedTraitKey]?.level;
      if (event.replacementTransition !== undefined) {
        delete equipped[event.replacementTransition.replacedTraitKey];
      }
      equipped[option.traitKey] = Object.freeze({
        traitKey: option.traitKey,
        giverKey: giver.key,
        providerKind: giver.providerKind,
        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
        ...(isLevelBearingTrait(catalog, option.traitKey)
          ? { level: event.selectedEffectiveLevel ?? 1 }
          : {}),
        ...(declaration.hammerCompatibility === undefined ? {} : { hammerRank: 'RankI' as const }),
        sourceRole: event.acquisitionRole,
        ...(event.acquisitionIdentity === undefined
          ? {}
          : { acquisitionIdentity: event.acquisitionIdentity }),
        ...(event.echoRepeatedKeepsakeKey === undefined
          ? {}
          : {
              echoRepeatedKeepsakeKey: event.echoRepeatedKeepsakeKey,
              echoKeepsakeReplayCount: 0,
            }),
      });
      const targeted = event.targetedAcquisitionTransition;
      if (targeted !== undefined) {
        const target = equipped[targeted.targetTraitKey];
        if (target !== undefined) {
          switch (targeted.kind) {
            case 'promoteGodTraitToHeroic':
              equipped[targeted.targetTraitKey] = withRarityAndSteadyGrowthCredit(
                catalog,
                target,
                targeted.newRarity,
              );
              break;
            case 'upgradeHammerToRank2':
              equipped[targeted.targetTraitKey] = Object.freeze({
                ...target,
                hammerRank: targeted.newHammerRank,
              });
              break;
          }
        }
      }
      if (event.replacementTransition !== undefined && event.selectedEffectiveLevel === undefined) {
        const replacement = equipped[event.replacementTransition.newTraitKey];
        if (replacement !== undefined && replacementLevel !== undefined) {
          equipped[event.replacementTransition.newTraitKey] = Object.freeze({
            ...replacement,
            level: replacementLevel + (event.replacementTransition.levelBonus ?? 0),
          });
        }
      }
    }
    const fromTraits = deriveFacts(catalog, equipped);
    const afterAcquisition = combinedElementFacts(fromTraits, pickupElements);
    const nextActiveSources = activeRarityFloorSources(
      catalog,
      equipped,
      afterAcquisition.elementCounts,
    );
    const newlyActive = new Set(
      [...nextActiveSources].filter((sourceKey) => !activeSources.has(sourceKey)),
    );
    promoteActiveFloorTargets(
      catalog,
      equipped,
      newlyActive,
      ordered
        .slice(0, index)
        .filter((event): event is TraitOfferEvent => event.kind === 'traitOffer'),
    );
    activeSources = nextActiveSources;
  }
  const fromTraits = deriveFacts(catalog, equipped);
  const derived = combinedElementFacts(fromTraits, pickupElements);
  return Object.freeze({
    events: Object.freeze(ordered),
    bannedTraitKeys: Object.freeze([...bannedTraitKeys]),
    previouslyPickedTraitKeys: Object.freeze([...previouslyPickedTraitKeys]),
    equippedTraits: Object.freeze(equipped),
    ...derived,
    ...(activeSources.size === 0 ? {} : { properUpbringingActive: true as const }),
    activeChaosCurses: Object.freeze(activeChaos),
    maturedChaosBlessings: Object.freeze(maturedChaos),
  });
}

export function traitDerivedFacts(history: TraitHistoryState) {
  return Object.freeze({
    upgradableTraitCount: history.upgradableTraitCount,
    elementCounts: history.elementCounts,
    highestBaseElementCount: history.highestBaseElementCount,
    godBoonRarityCounts: history.godBoonRarityCounts,
  });
}

export function attachTraitHistory(
  rewardHistory: RewardHistoryState,
  traitHistory: TraitHistoryState,
): RewardHistoryState {
  return Object.freeze({
    ...rewardHistory,
    traitFacts: traitDerivedFacts(traitHistory),
  });
}

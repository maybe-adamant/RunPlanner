export interface NaturalSelectionStep {
  readonly targetTraitKey: string;
  readonly oldLevel: number;
  readonly newLevel: number;
}

export interface NaturalSelectionTargetAssessment {
  readonly legal: boolean;
  /** A legal prefix is complete only at eight successes or a true empty next domain. */
  readonly complete: boolean;
  readonly steps: readonly NaturalSelectionStep[];
  readonly nextTargetTraitKeys: readonly string[];
}

/**
 * Validates Natural Selection against its immutable pre-acquisition frontier.
 * The initial author-selected round is the game's one shuffled order. The
 * currently simulated prefix only removes a cooldown-capped Hephaestus target
 * at the precise increment that makes further upgrades ineffective; later
 * turns retain the same surviving cyclic order and never become persisted
 * effect state.
 */
export function assessNaturalSelectionTargets(
  catalog: Catalog,
  before: TraitHistoryState,
  levelCount: number,
  slots: readonly TraitOrdinaryBoonSlot[],
  targets: readonly string[] | undefined,
): NaturalSelectionTargetAssessment {
  const simulated = new Map(
    Object.values(before.equippedTraits).map((trait) => [trait.traitKey, trait]),
  );
  const initiallyEligible = [...simulated.values()]
    .filter((trait) => {
      const slot = catalog.traits.byKey[trait.traitKey]?.equipmentSlot;
      return (
        slot !== undefined &&
        slot !== 'Spell' &&
        slots.includes(slot) &&
        isPomUpgradeTarget(catalog, trait)
      );
    })
    .map((trait) => trait.traitKey);
  if (initiallyEligible.length === 0 || initiallyEligible.length > levelCount)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  if (targets === undefined || targets.length === 0)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze(initiallyEligible),
    });
  if (targets.length > levelCount)
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  if (targets.length < initiallyEligible.length) {
    const prefix = targets;
    if (
      new Set(prefix).size !== prefix.length ||
      prefix.some((traitKey) => !initiallyEligible.includes(traitKey))
    )
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    return Object.freeze({
      legal: true,
      complete: false,
      steps: Object.freeze(
        prefix.map((targetTraitKey) => {
          const target = simulated.get(targetTraitKey)!;
          return Object.freeze({
            targetTraitKey,
            oldLevel: target.level!,
            newLevel: target.level! + 1,
          });
        }),
      ),
      nextTargetTraitKeys: Object.freeze(initiallyEligible.filter((key) => !prefix.includes(key))),
    });
  }
  const stableOrder = targets.slice(0, initiallyEligible.length);
  if (
    new Set(stableOrder).size !== stableOrder.length ||
    stableOrder.some((traitKey) => !initiallyEligible.includes(traitKey)) ||
    initiallyEligible.some((traitKey) => !stableOrder.includes(traitKey))
  )
    return Object.freeze({
      legal: false,
      complete: false,
      steps: Object.freeze([]),
      nextTargetTraitKeys: Object.freeze([]),
    });
  let cursor = 0;
  const steps: NaturalSelectionStep[] = [];
  for (const targetTraitKey of targets) {
    let target: EquippedTrait | undefined;
    for (let attempts = 0; attempts < stableOrder.length; attempts += 1) {
      const candidateKey = stableOrder[cursor]!;
      cursor = (cursor + 1) % stableOrder.length;
      const candidate = simulated.get(candidateKey);
      if (isPomUpgradeTarget(catalog, candidate)) {
        target = candidate;
        break;
      }
    }
    if (target?.traitKey !== targetTraitKey)
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    if (target.level === undefined)
      return Object.freeze({
        legal: false,
        complete: false,
        steps: Object.freeze([]),
        nextTargetTraitKeys: Object.freeze([]),
      });
    const oldLevel = target.level;
    const newLevel = oldLevel + 1;
    simulated.set(targetTraitKey, Object.freeze({ ...target, level: newLevel }));
    steps.push(Object.freeze({ targetTraitKey, oldLevel, newLevel }));
  }
  const nextTargetTraitKeys: string[] = [];
  for (let attempts = 0; attempts < stableOrder.length; attempts += 1) {
    const candidateKey = stableOrder[(cursor + attempts) % stableOrder.length]!;
    if (isPomUpgradeTarget(catalog, simulated.get(candidateKey))) {
      nextTargetTraitKeys.push(candidateKey);
      break;
    }
  }
  return Object.freeze({
    legal: true,
    complete: targets.length === levelCount || nextTargetTraitKeys.length === 0,
    steps: Object.freeze(steps),
    nextTargetTraitKeys: Object.freeze(nextTargetTraitKeys),
  });
}

export function assessTraitOption(
  catalog: Catalog,
  traitKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
  rarity?: TraitRarity,
): TraitAssessment {
  const trait = catalog.traits.byKey[traitKey];
  if (trait === undefined)
    return {
      legal: false,
      findings: [{ code: 'missingPrerequisite', traitKey, detail: 'unknown trait' }],
    };
  const findings: TraitAssessmentFinding[] = [];
  if (history.bannedTraitKeys.includes(traitKey)) findings.push({ code: 'bannedTrait', traitKey });
  if (history.equippedTraits[traitKey] !== undefined)
    findings.push({ code: 'alreadyEquipped', traitKey });
  if (
    trait.blockOfferIfPreviouslyPicked &&
    history.equippedTraits[traitKey] === undefined &&
    history.previouslyPickedTraitKeys.includes(traitKey)
  )
    findings.push({ code: 'previouslyPicked', traitKey });
  for (const requirement of trait.offerRequirements) {
    const failure = checkRequirement(catalog, requirement, trait, history, context);
    if (failure !== undefined) findings.push({ ...failure, traitKey });
  }
  if (
    trait.targetedAcquisition !== undefined &&
    targetedAcquisitionTargetKeys(catalog, traitKey, history).length === 0
  ) {
    findings.push({ code: 'targetedAcquisitionNoEligibleTarget', traitKey });
  }
  if (context.devotionNoDuo && rarity === 'Duo')
    findings.push({ code: 'offerContext', traitKey, detail: 'devotionNoDuo' });
  if (trait.equipmentSlot !== undefined && history.equippedSlots[trait.equipmentSlot] !== undefined)
    findings.push({ code: 'occupiedBoonSlot', traitKey, detail: trait.equipmentSlot });
  if (
    trait.hammerCompatibility !== undefined &&
    ((context.weaponKey !== undefined &&
      context.weaponKey !== trait.hammerCompatibility.weaponKey) ||
      (context.aspectKey !== undefined &&
        !trait.hammerCompatibility.aspectKeys.includes(context.aspectKey)))
  )
    findings.push({ code: 'wrongHammerLoadout', traitKey });
  let replacementTransition: TraitReplacementTransition | undefined;
  if (
    context.boonRarityFacts !== undefined &&
    rarity !== undefined &&
    trait.usesBoonRarity &&
    trait.rarityDomain.kind === 'ranked' &&
    trait.rarityDomain.freshOfferRarities.includes(rarity) &&
    boonRarityRollUnavailable(
      context.boonRarityFacts,
      rarity,
      trait.rarityDomain.freshOfferRarities,
    )
  )
    findings.push({ code: 'rarityRollUnavailable', traitKey, detail: rarity });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastRunBoon' &&
    !echoLastRunBoonOutcomes(catalog, history).some((outcome) => outcome.assessment.legal)
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRunBoonEmpty' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'lastReward' &&
    context.echoLastRewardAvailable !== true
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoLastRewardMissing' });
  if (
    trait.selectedDisposition.kind === 'echo' &&
    trait.selectedDisposition.effect === 'repeatKeepsake' &&
    (context.currentKeepsakeKey === undefined ||
      trait.selectedDisposition.excludedKeepsakeKeys.includes(context.currentKeepsakeKey))
  )
    findings.push({ code: 'offerContext', traitKey, detail: 'echoKeepsakeExcluded' });
  const occupied =
    trait.equipmentSlot === undefined ? undefined : history.equippedSlots[trait.equipmentSlot];
  const giver = context.resolvedProviderKey
    ? catalog.traitGivers.byKey[context.resolvedProviderKey]
    : undefined;
  const priority = giver === undefined ? false : giver.priorityTraitKeys.includes(traitKey);
  const replacementEligible =
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    occupied.traitKey !== traitKey &&
    giver?.providerKind === 'olympian' &&
    priority &&
    history.equippedTraits[traitKey] === undefined;
  if (replacementEligible && occupied !== undefined && trait.equipmentSlot !== undefined) {
    const requiredRarity =
      occupied.rarity === undefined
        ? undefined
        : nextRarity(catalog, occupied.traitKey, occupied.rarity);
    const occupiedIndex = findings.findIndex((finding) => finding.code === 'occupiedBoonSlot');
    const nonSlotFindings = findings.filter((finding) => finding.code !== 'occupiedBoonSlot');
    if (requiredRarity === undefined) {
      findings.push({
        code: 'replacementMaximumRarity',
        traitKey,
        detail: occupied.traitKey,
      });
    } else if (rarity !== requiredRarity) {
      // Retain a precise replacement-shaped diagnostic rather than exposing
      // arbitrary rarity variants for an occupied slot.
      if (occupiedIndex >= 0 && nonSlotFindings.length === 0) findings.splice(occupiedIndex, 1);
      findings.push({
        code: 'replacementRarityMismatch',
        traitKey,
        detail: `${requiredRarity}:${rarity ?? 'missing'}`,
      });
    } else if (nonSlotFindings.length === 0) {
      if (occupiedIndex >= 0) findings.splice(occupiedIndex, 1);
      replacementTransition = Object.freeze({
        slot: trait.equipmentSlot,
        replacedTraitKey: occupied.traitKey,
        oldRarity: occupied.rarity as TraitRarity,
        newTraitKey: traitKey,
        requiredRarity,
      });
    }
  } else if (
    context.ordinarySlotReplacement !== 'forbidden' &&
    occupied !== undefined &&
    trait.equipmentSlot !== undefined
  ) {
    findings.push({
      code: 'replacementUnavailable',
      traitKey,
      detail: trait.equipmentSlot,
    });
  }
  // A source override is the exact rarity for fresh rows, not an offer-wide
  // rewrite. Legal replacements retain their explicit promoted rarity even
  // when the fresh table is overridden (for example, Ordinary at Common).
  if (
    trait.rarityDomain.kind === 'ranked' &&
    rarity !== undefined &&
    (context.freshRarityOverride === undefined
      ? !trait.rarityDomain.freshOfferRarities.includes(rarity)
      : rarity !== context.freshRarityOverride) &&
    replacementTransition === undefined
  ) {
    findings.push({
      code: 'freshRarityUnavailable',
      traitKey,
      detail: rarity,
    });
  }
  return Object.freeze({
    legal: findings.length === 0,
    findings: Object.freeze(findings),
    ...(replacementTransition === undefined ? {} : { replacementTransition }),
  });
}

export function assessTraitOffer(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitAssessment[] {
  if (offer.kind !== 'traits') return Object.freeze([]);
  const offerContext = { ...context, resolvedProviderKey: offer.giverKey };
  let hymnApplied = false;
  return Object.freeze(
    offer.options.map((option) => {
      const assessment = assessTraitOption(
        catalog,
        option.traitKey,
        history,
        offerContext,
        option.rarity,
      );
      if (
        hymnApplied ||
        (context.limitedSwapUses ?? 0) === 0 ||
        assessment.replacementTransition === undefined
      )
        return assessment;
      hymnApplied = true;
      return Object.freeze({
        ...assessment,
        replacementTransition: Object.freeze({
          ...assessment.replacementTransition,
          levelBonus: 2,
        }),
      });
    }),
  );
}

/**
 * The offer frontier Calling Card is allowed to act on.  This deliberately
 * excludes selected-only acquisition consequences: spending a row action is
 * an offer action, so a later invalid selected child must not undo it.
 */
export function assessTraitOfferBeforeRarification(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): {
  readonly assessments: readonly TraitAssessment[];
  readonly composition: TraitOfferCompositionAssessment;
  readonly replacementComposition: TraitReplacementCompositionAssessment;
  readonly legal: boolean;
} {
  const assessments = assessTraitOffer(catalog, offer, history, context);
  const composition = assessTraitOfferComposition(catalog, offer, history);
  const replacementComposition = assessTraitReplacementComposition(
    catalog,
    offer,
    history,
    context,
  );
  return Object.freeze({
    assessments,
    composition,
    replacementComposition,
    legal:
      composition.legal &&
      replacementComposition.legal &&
      assessments.every((assessment) => assessment.legal),
  });
}

export function assessSelectedTargetedAcquisition(
  catalog: Catalog,
  offer: AuthoredTraitOffer,
  history: TraitHistoryState,
): TraitTargetedAcquisitionAssessment {
  if (offer.kind !== 'traits')
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  const option = offer.options[optionIndex(offer.selectedOptionKey)];
  if (option === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const acquisition = catalog.traits.byKey[option.traitKey]?.targetedAcquisition;
  if (acquisition === undefined) {
    return Object.freeze({ applies: false, legal: true, findings: Object.freeze([]) });
  }
  const targets = targetedAcquisitionTargetKeys(catalog, option.traitKey, history);
  if (targets.length === 0) {
    return Object.freeze({
      applies: true,
      legal: true,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([]),
    });
  }
  if (option.targetTraitKey === undefined) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetMissing' as const,
      traitKey: option.traitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      findings: Object.freeze([finding]),
    });
  }
  if (!targets.includes(option.targetTraitKey)) {
    const finding = Object.freeze({
      code: 'targetedAcquisitionTargetUnavailable' as const,
      traitKey: option.traitKey,
      detail: option.targetTraitKey,
    });
    return Object.freeze({
      applies: true,
      legal: false,
      sourceTraitKey: option.traitKey,
      targetTraitKey: option.targetTraitKey,
      findings: Object.freeze([finding]),
    });
  }
  const target = history.equippedTraits[option.targetTraitKey];
  if (target === undefined) {
    throw new Error(`targeted acquisition target ${option.targetTraitKey} is not equipped`);
  }
  const transition: TraitTargetedAcquisitionTransition =
    acquisition.kind === 'promoteGodTraitToHeroic'
      ? (() => {
          if (target.rarity === undefined) {
            throw new Error(`targeted acquisition target ${option.targetTraitKey} has no rarity`);
          }
          return Object.freeze({
            kind: 'promoteGodTraitToHeroic' as const,
            sourceTraitKey: option.traitKey,
            targetTraitKey: option.targetTraitKey,
            oldRarity: target.rarity,
            newRarity: 'Heroic' as const,
            oldLevel: target.level ?? 0,
            newLevel: (target.level ?? 0) + bridalGlowAddedLevels(option.rarity),
          });
        })()
      : Object.freeze({
          kind: 'upgradeHammerToRank2' as const,
          sourceTraitKey: option.traitKey,
          targetTraitKey: option.targetTraitKey,
          oldHammerRank: 'RankI' as const,
          newHammerRank: 'RankII' as const,
        });
  return Object.freeze({
    applies: true,
    legal: true,
    sourceTraitKey: option.traitKey,
    targetTraitKey: option.targetTraitKey,
    findings: Object.freeze([]),
    transition,
  });
}

export interface TraitCandidateAssessment {
  readonly traitKey: string;
  readonly rarity?: TraitRarity;
  readonly available: boolean;
  readonly assessment: TraitAssessment;
}

export function traitCandidates(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): readonly TraitCandidateAssessment[] {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return Object.freeze([]);
  const firstOlympian =
    giver.providerKind === 'olympian' && Object.keys(ordinaryEquippedSlots(history)).length === 0;
  const priority = new Set(giver.priorityTraitKeys);
  const addCompositionContext = (
    traitKey: string,
    assessment: TraitAssessment,
  ): TraitAssessment => {
    if (!firstOlympian || priority.has(traitKey)) return assessment;
    return Object.freeze({
      legal: false,
      findings: Object.freeze([
        ...assessment.findings,
        Object.freeze({ code: 'nonPriorityTrait' as const, traitKey }),
      ]),
    });
  };
  const candidates: TraitCandidateAssessment[] = [];
  for (const traitKey of giver.traitKeys) {
    const trait = catalog.traits.byKey[traitKey];
    if (trait === undefined) continue;
    const assessment = addCompositionContext(
      traitKey,
      assessTraitOption(catalog, traitKey, history, { ...context, resolvedProviderKey: giverKey }),
    );
    if (trait.rarityDomain.kind === 'none') {
      candidates.push(Object.freeze({ traitKey, available: assessment.legal, assessment }));
      continue;
    }
    const freshRarities =
      context.freshRarityOverride === undefined
        ? trait.rarityDomain.freshOfferRarities
        : [context.freshRarityOverride];
    for (const rarity of freshRarities) {
      // Ordinary fresh generation never admits Heroic. A chronological source
      // override such as progressed Gorgon rarity is already the exact result.
      if (rarity === 'Heroic' && context.freshRarityOverride !== 'Heroic') continue;
      const rarityAssessment = addCompositionContext(
        traitKey,
        assessTraitOption(
          catalog,
          traitKey,
          history,
          { ...context, resolvedProviderKey: giverKey },
          rarity,
        ),
      );
      // A fresh rarity that is also the exact promoted replacement rarity is
      // represented by the replacement candidate below, never as an ordinary
      // arbitrary variant for an occupied slot.
      if (rarityAssessment.replacementTransition !== undefined) continue;
      candidates.push(
        Object.freeze({
          traitKey,
          rarity,
          available: rarityAssessment.legal,
          assessment: rarityAssessment,
        }),
      );
    }
  }
  // Replacement candidates are exact promoted-rarity variants. They are
  // intentionally emitted in addition to fresh variants only for the giver's
  // priority set; Heroic can therefore appear only as Epic-to-Heroic evidence.
  if (giver.providerKind === 'olympian') {
    for (const traitKey of giver.priorityTraitKeys) {
      const trait = catalog.traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked') continue;
      const occupied =
        trait.equipmentSlot === undefined ? undefined : history.equippedSlots[trait.equipmentSlot];
      if (occupied === undefined) continue;
      const required =
        occupied.rarity === undefined
          ? undefined
          : nextRarity(catalog, occupied.traitKey, occupied.rarity);
      if (required === undefined) continue;
      const assessment = assessTraitOption(
        catalog,
        traitKey,
        history,
        { ...context, resolvedProviderKey: giverKey },
        required,
      );
      candidates.push(
        Object.freeze({
          traitKey,
          rarity: required,
          available: assessment.legal && assessment.replacementTransition !== undefined,
          assessment,
        }),
      );
    }
  }
  return Object.freeze(candidates);
}

/**
 * Partitions exact legal candidates from one immutable pre-offer frontier.
 * `traitCandidates` supplies the shared first-Olympian priority restriction,
 * so composition cannot accidentally admit a candidate the picker rejects.
 */
export function traitOfferCompositionDomains(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): TraitOfferCompositionDomains {
  const key = compositionDomainCacheKey(giverKey, context);
  let byHistory = compositionDomainCache.get(catalog);
  if (byHistory === undefined) {
    byHistory = new WeakMap();
    compositionDomainCache.set(catalog, byHistory);
  }
  let cached = byHistory.get(history);
  if (cached === undefined) {
    cached = new Map();
    byHistory.set(history, cached);
  }
  const previous = cached.get(key);
  if (previous !== undefined) return previous;
  const ordinary: TraitCandidateAssessment[] = [];
  const highTier: TraitCandidateAssessment[] = [];
  const replacements: TraitCandidateAssessment[] = [];
  for (const candidate of traitCandidates(catalog, giverKey, history, context)) {
    if (!candidate.available) continue;
    if (candidate.assessment.replacementTransition !== undefined) {
      replacements.push(candidate);
      continue;
    }
    const trait = catalog.traits.byKey[candidate.traitKey];
    if (trait?.rarityDomain.kind !== 'ranked') continue;
    if (trait.rarityDomain.freshOfferRarities.includes('Common')) ordinary.push(candidate);
    else if (candidate.rarity === 'Duo' || candidate.rarity === 'Legendary')
      highTier.push(candidate);
  }
  const domains = Object.freeze({
    ordinary: Object.freeze(ordinary),
    highTier: Object.freeze(highTier),
    replacements: Object.freeze(replacements),
  });
  cached.set(key, domains);
  return domains;
}

/**
 * Returns one engine-validated traits outcome for changing a Fallback Gold
 * draft back to traits.  Consumers must not derive exhaustion fill rules.
 */
export function traitOfferStartingDraft(
  catalog: Catalog,
  giverKey: string,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const giver = catalog.traitGivers.byKey[giverKey];
  if (giver === undefined) return undefined;
  const domains = traitOfferCompositionDomains(catalog, giverKey, history, context);
  const allCandidates = traitOfferSupportsExhaustion(giver)
    ? [...domains.ordinary, ...domains.highTier, ...domains.replacements]
    : traitCandidates(catalog, giverKey, history, context).filter(
        (candidate) => candidate.available,
      );
  const variants = automaticDraftCandidates(allCandidates);
  const selfContained = selfContainedDraftCandidates(catalog, variants, history);
  const chosen = traitOfferSupportsExhaustion(giver)
    ? selectSelfContainedFirst(
        exhaustionStartingCandidates(
          catalog,
          domains,
          context.replacementRollChance ?? catalog.boonReplacementChance,
        ),
        selfContained,
      )
    : fixedStartingCandidates(variants, selfContained);
  if (chosen.length === 0 || (!traitOfferSupportsExhaustion(giver) && chosen.length !== 3))
    return undefined;
  const draft = traitDraft(giverKey, chosen);
  const completeDraft =
    giver.providerKind === 'spell'
      ? Object.freeze({
          ...draft,
          hexTree: createDefaultAuthoredHexTree(catalog, draft.options[0]!.traitKey),
        })
      : draft;
  // Candidate domains establish leaf legality. Keep the authoritative complete
  // offer checks at this boundary, once, rather than evaluating every variant.
  return assessTraitOfferComposition(catalog, completeDraft, history).legal &&
    assessTraitReplacementComposition(catalog, completeDraft, history, context).legal &&
    assessTraitOffer(catalog, completeDraft, history, context).every(
      (assessment) => assessment.legal,
    )
    ? completeDraft
    : undefined;
}

/** Returns one exact supported draft with the next materialized option appended. */
export function nextTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  if (draft.options.length >= 3) return undefined;
  const giver = catalog.traitGivers.byKey[draft.giverKey];
  if (giver === undefined) return undefined;
  const domains = traitOfferCompositionDomains(catalog, draft.giverKey, history, context);
  const variants = automaticDraftCandidates(
    traitOfferSupportsExhaustion(giver)
      ? [...domains.ordinary, ...domains.highTier, ...domains.replacements]
      : traitCandidates(catalog, draft.giverKey, history, context).filter(
          (candidate) => candidate.available,
        ),
  );
  const candidateByKey = new Map(variants.map((candidate) => [candidate.traitKey, candidate]));
  // Check the materialized prefix once. Subsequent completion search operates
  // exclusively on this already-derived candidate domain.
  if (
    assessTraitOffer(catalog, draft, history, context).some((assessment) => !assessment.legal) ||
    draft.options.some((option) => !candidateByKey.has(option.traitKey))
  )
    return undefined;
  const append = (
    current: AuthoredTraitOfferTraits,
    candidate: TraitCandidateAssessment,
  ): AuthoredTraitOfferTraits =>
    Object.freeze({
      ...current,
      options: Object.freeze([
        ...current.options,
        candidateToOption(candidate),
      ]) as AuthoredTraitOfferTraits['options'],
    });
  const canComplete = (current: AuthoredTraitOfferTraits): boolean => {
    if (!traitOfferSupportsExhaustion(giver)) {
      const offered = new Set(current.options.map((option) => option.traitKey));
      return current.options.length === 3
        ? true
        : variants.filter((candidate) => !offered.has(candidate.traitKey)).length >=
            3 - current.options.length;
    }
    const composition = assessDraftDomainComposition(
      current,
      domains,
      context.replacementRollChance ?? catalog.boonReplacementChance,
    );
    if (composition.legal) return assessTraitOfferComposition(catalog, current, history).legal;
    if (current.options.length >= 3) return false;
    const offered = new Set(current.options.map((option) => option.traitKey));
    return variants.some(
      (candidate) => !offered.has(candidate.traitKey) && canComplete(append(current, candidate)),
    );
  };
  const offered = new Set(draft.options.map((option) => option.traitKey));
  for (const candidate of variants) {
    if (!candidate.available || offered.has(candidate.traitKey)) continue;
    const next = append(draft, candidate);
    if (canComplete(next)) return next;
  }
  return undefined;
}

function isOptionalHighTierOption(catalog: Catalog, option: AuthoredTraitOption): boolean {
  const declaration = catalog.traits.byKey[option.traitKey];
  return (
    declaration?.rarityDomain.kind === 'ranked' &&
    declaration.rarityDomain.freshOfferRarities.length > 0 &&
    declaration.rarityDomain.freshOfferRarities.every(
      (rarity) => rarity === 'Duo' || rarity === 'Legendary',
    )
  );
}

/** Adds only one optional Duo/Legendary outcome to an otherwise retained offer shape. */
export function nextOptionalHighTierTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
  history: TraitHistoryState,
  context: TraitOfferContext = {},
): AuthoredTraitOfferTraits | undefined {
  const next = nextTraitOfferDraft(catalog, draft, history, context);
  if (next === undefined || next.options.length !== draft.options.length + 1) return undefined;
  const appended = next.options.at(draft.options.length);
  return appended !== undefined && isOptionalHighTierOption(catalog, appended) ? next : undefined;
}

/** Removes only a trailing optional Duo/Legendary outcome; candidate assessment owns legality. */
export function previousOptionalHighTierTraitOfferDraft(
  catalog: Catalog,
  draft: AuthoredTraitOfferTraits,
): AuthoredTraitOfferTraits | undefined {
  if (draft.options.length <= 1) return undefined;
  const removed = draft.options.at(-1);
  if (removed === undefined || !isOptionalHighTierOption(catalog, removed)) return undefined;
  const options = Object.freeze(draft.options.slice(0, -1)) as AuthoredTraitOfferTraits['options'];
  const selectedIndex = optionIndex(draft.selectedOptionKey);
  return Object.freeze({
    ...draft,
    options,
    selectedOptionKey: TRAIT_OPTION_KEYS[Math.min(selectedIndex, options.length - 1)]!,
  });
}

function traitDraft(
  giverKey: string,
  candidates: readonly TraitCandidateAssessment[],
): AuthoredTraitOfferTraits {
  return Object.freeze({
    kind: 'traits',
    giverKey,
    options: Object.freeze(
      candidates.map(candidateToOption),
    ) as AuthoredTraitOfferTraits['options'],
    selectedOptionKey: 'option1',
    rarificationActions: Object.freeze([]),
  });
}

/** Deterministic representative of the O/H/R contract for a fresh draft. */
function exhaustionStartingCandidates(
  catalog: Catalog,
  domains: TraitOfferCompositionDomains,
  replacementRollChance: number,
): readonly TraitCandidateAssessment[] {
  const ordinary = automaticDraftCandidates(domains.ordinary);
  const highTier = automaticDraftCandidates(domains.highTier);
  const replacements = automaticDraftCandidates(domains.replacements);
  if (replacementRollChance === 1 && replacements.length > 0) {
    const replacement = replacements[0]!;
    const remainder = [...ordinary, ...highTier, ...replacements.slice(1)].slice(0, 2);
    return [replacement, ...remainder];
  }
  if (ordinary.length >= 3) {
    const priority = ordinary.slice(0, 3);
    if (priority.some((candidate) => isAttackOrSpecial(catalog, candidate.traitKey)))
      return priority;
    const attackOrSpecial = ordinary.find((candidate) =>
      isAttackOrSpecial(catalog, candidate.traitKey),
    );
    return attackOrSpecial === undefined
      ? priority
      : [
          attackOrSpecial,
          ...ordinary.filter((candidate) => candidate !== attackOrSpecial).slice(0, 2),
        ];
  }
  if (ordinary.length > 0) {
    const withReplacements = [...ordinary, ...replacements.slice(0, 3 - ordinary.length)];
    return [...withReplacements, ...highTier.slice(0, 3 - withReplacements.length)];
  }
  if (replacements.length > 0) return replacements.slice(0, 3);
  return highTier.length > 0 ? [highTier[0]!] : [];
}

function fixedStartingCandidates(
  variants: readonly TraitCandidateAssessment[],
  selfContained: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const selected = selfContained[0];
  if (selected === undefined) return [];
  return [
    selected,
    ...variants.filter((candidate) => candidate.traitKey !== selected.traitKey).slice(0, 2),
  ];
}

/** A targeted/Circe leaf needs no target when it is merely an unselected row. */
function selectSelfContainedFirst(
  candidates: readonly TraitCandidateAssessment[],
  selfContained: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const selected = candidates.find((candidate) =>
    selfContained.some(
      (selfContainedCandidate) => selfContainedCandidate.traitKey === candidate.traitKey,
    ),
  );
  return selected === undefined
    ? []
    : [selected, ...candidates.filter((candidate) => candidate.traitKey !== selected.traitKey)];
}

function isAttackOrSpecial(catalog: Catalog, traitKey: string): boolean {
  const slot = catalog.traits.byKey[traitKey]?.equipmentSlot;
  return slot === 'Melee' || slot === 'Secondary';
}

function assessDraftDomainComposition(
  draft: AuthoredTraitOfferTraits,
  domains: TraitOfferCompositionDomains,
  replacementRollChance: number,
): TraitOfferDomainCompositionResult {
  const ordinary = new Set(domains.ordinary.map((candidate) => candidate.traitKey));
  const highTier = new Set(domains.highTier.map((candidate) => candidate.traitKey));
  const replacements = new Set(domains.replacements.map((candidate) => candidate.traitKey));
  return assessTraitOfferDomainComposition({
    ordinaryKeys: Object.freeze([...ordinary]),
    highTierKeys: Object.freeze([...highTier]),
    replacementKeys: Object.freeze([...replacements]),
    authored: Object.freeze(
      draft.options.map((option) =>
        Object.freeze({
          traitKey: option.traitKey,
          kind: replacements.has(option.traitKey)
            ? 'replacement'
            : highTier.has(option.traitKey)
              ? 'highTier'
              : 'ordinary',
        }),
      ),
    ),
    fallbackGold: false,
    replacementRollChance,
  });
}

function candidateToOption(candidate: TraitCandidateAssessment): AuthoredTraitOption {
  return Object.freeze({
    traitKey: candidate.traitKey,
    ...(candidate.rarity === undefined ? {} : { rarity: candidate.rarity }),
  });
}

/** De-duplicates rarity variants to one deterministic row per trait key. */
function automaticDraftCandidates(
  candidates: readonly TraitCandidateAssessment[],
): readonly TraitCandidateAssessment[] {
  const seen = new Set<string>();
  return Object.freeze(
    candidates.filter((candidate) => {
      if (seen.has(candidate.traitKey)) return false;
      seen.add(candidate.traitKey);
      return true;
    }),
  );
}

/** Only the selected first row must be independently actionable. */
function selfContainedDraftCandidates(
  catalog: Catalog,
  candidates: readonly TraitCandidateAssessment[],
  history: TraitHistoryState,
): readonly TraitCandidateAssessment[] {
  return Object.freeze(
    candidates.filter((candidate) => {
      const trait = catalog.traits.byKey[candidate.traitKey];
      return !(
        (trait?.targetedAcquisition !== undefined &&
          targetedAcquisitionTargetKeys(catalog, candidate.traitKey, history).length > 0) ||
        trait?.selectedDisposition.kind === 'circe'
      );
    }),
  );
}

import type { Catalog, TraitOrdinaryBoonSlot, TraitRarity } from '../catalog-schema';
import type {
  AuthoredTraitOffer,
  AuthoredTraitOfferTraits,
  AuthoredTraitOption,
  EquippedTrait,
} from '../authored-project/traits';
import { boonRarityRollUnavailable } from './boon-rarity';
export type { TraitFindingCode } from './model';
import {
  optionIndex,
  TRAIT_OPTION_KEYS,
  traitOfferSupportsExhaustion,
} from '../authored-project/traits';
import { createDefaultAuthoredHexTree } from '../authored-project/hex-tree';
import {
  isPomUpgradeTarget,
  nextRarity,
  ordinaryEquippedSlots,
  type TraitHistoryState,
  type TraitReplacementTransition,
  type TraitTargetedAcquisitionAssessment,
  type TraitTargetedAcquisitionTransition,
} from './trait-history';
import {
  targetedAcquisitionTargetKeys,
  checkRequirement,
  bridalGlowAddedLevels,
} from './trait-level-effects';
import {
  echoLastRunBoonOutcomes,
  assessTraitOfferComposition,
  assessTraitReplacementComposition,
  assessTraitOfferDomainComposition,
  compositionDomainCacheKey,
  compositionDomainCache,
  type TraitOfferContext,
  type TraitAssessment,
  type TraitAssessmentFinding,
  type TraitOfferCompositionAssessment,
  type TraitReplacementCompositionAssessment,
  type TraitOfferCompositionDomains,
  type TraitOfferDomainCompositionResult,
} from './trait-offers';

import type { Catalog } from '../../catalog-schema';
import {
  applyProjectCommand,
  ProjectCommandContractError,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type ProjectCommand,
  type ProjectDocument,
  type SemanticAddress,
  type TraitOfferAddress,
} from '../../authored-project';
import { createDefaultAuthoredHexTree } from '../../authored-project/traits/hex-tree';
import type { ProjectCandidateSession } from '../candidates/session';
import { draftCappedGiver, draftExcludingTraitKeys, draftIllegalTrait } from './basket';
import { completeCarrierChildren, type DraftCarrierChildContext } from './carrier-children';
import { draftDenialActive, type DraftSpec } from './spec';
import type { DraftProgress, DraftSteering } from './steering';

/** What trait-offer authoring borrows from the walk. */
export interface DraftTraitOfferContext {
  readonly catalog: Catalog;
  readonly spec: DraftSpec;
  readonly steering: DraftSteering;
  /** Keys of repairs already tried in this walk. */
  readonly hooked: Set<string>;
  readonly project: () => ProjectDocument;
  readonly evaluate: ProjectCandidateSession['evaluate'];
  readonly startingOutcome: (
    trait: TraitOfferAddress,
    giverKey: string,
  ) => AuthoredTraitOffer | undefined;
  readonly apply: (command: ProjectCommand) => boolean;
  readonly shuffle: <T>(values: readonly T[]) => T[];
  /** Records why the biome cannot continue. */
  readonly fail: (reason: string) => void;
}

const OPTION_KEYS = ['option1', 'option2', 'option3'] as const;
/** Replacement traits tried for one unselected row that needs no change. */
const FILLER_DRAWS = 4;
/** Outside traits tried in a row when no offered row may be taken. */
const SUBSTITUTE_DRAWS = 20;

/** A Gorgon Athena offer persists only its three traits and the selected row. */
function offerCommand(trait: TraitOfferAddress, value: AuthoredTraitOffer): ProjectCommand {
  if (trait.owner.kind !== 'gorgonPhase' || value.kind !== 'traits')
    return { kind: 'ReplaceTraitOffer', trait, value };
  const [first, second, third] = value.options;
  // The command authority refuses a Gorgon offer of fewer rows.
  if (second === undefined || third === undefined)
    return { kind: 'ReplaceTraitOffer', trait, value };
  return {
    kind: 'ReplaceGorgonAthenaOffer',
    trait,
    value: {
      traitKeys: [first.traitKey, second.traitKey, third.traitKey],
      selectedOptionKey: value.selectedOptionKey,
    },
  };
}

/** Authors trait offers toward the basket, with every selected-outcome child complete. */
export class DraftTraitOffers {
  private readonly denial: boolean;
  /** Trait offers this walk authored, by address, for re-picking a stale child. */
  private readonly authoredOffers = new Map<string, AuthoredTraitOfferTraits>();
  /** Each trait outside the basket by the basket traits its holding would keep from being offered. */
  private readonly excludes = new Map<string, string[]>();

  constructor(private readonly context: DraftTraitOfferContext) {
    this.denial = draftDenialActive(context.catalog, context.spec.loadout);
    const basket = context.steering.basket;
    for (const basketKey of basket)
      for (const key of draftExcludingTraitKeys(context.catalog, basketKey))
        if (!basket.includes(key))
          (this.excludes.get(key) ?? this.excludes.set(key, []).get(key)!).push(basketKey);
  }

  private get catalog(): Catalog {
    return this.context.catalog;
  }

  private offerSupported(trait: TraitOfferAddress, value: AuthoredTraitOffer): boolean {
    const evaluation = this.context.evaluate({ kind: 'traitOffer', trait, value });
    return (
      evaluation.kind === 'traitOffer' &&
      evaluation.result.supported &&
      evaluation.result.findings.length === 0
    );
  }

  /**
   * A trait a source other than a trait offer may add: never draft-illegal, a
   * slot the basket reserves or holds, or past its giver's cap with the basket's owed traits.
   */
  traitAllowed(traitKey: string, progress: DraftProgress): boolean {
    const declaration = this.catalog.traits.byKey[traitKey];
    if (declaration === undefined || draftIllegalTrait(declaration)) return false;
    if (!this.basketAllows(traitKey)) return false;
    if (!this.context.steering.orderAllows(traitKey, progress)) return false;
    const slot = declaration.equipmentSlot;
    if (
      slot !== undefined &&
      slot !== 'Spell' &&
      progress.equippedTraitKeys.some(
        (key) => key !== traitKey && this.catalog.traits.byKey[key]?.equipmentSlot === slot,
      )
    )
      return false;
    const capped = draftCappedGiver(this.catalog, this.context.spec, traitKey);
    const wanted = this.context.steering.wantedBasket(progress);
    if (capped === undefined || wanted.includes(traitKey)) return true;
    const ofGiver = (key: string) =>
      draftCappedGiver(this.catalog, this.context.spec, key)?.giverKey === capped.giverKey;
    return (
      progress.equippedTraitKeys.filter(ofGiver).length + wanted.filter(ofGiver).length < capped.cap
    );
  }

  private childContext(trait: TraitOfferAddress): DraftCarrierChildContext {
    const steering = this.context.steering;
    const progress = steering.progress();
    return {
      catalog: this.catalog,
      evaluate: (query) => this.context.evaluate(query),
      shuffle: (values) => this.context.shuffle(values),
      allowsTrait: (traitKey) => this.traitAllowed(traitKey, progress),
      prefersTrait: (traitKey) => {
        const now = steering.progress();
        return steering.wantedBasket(now).includes(traitKey) && steering.orderAllows(traitKey, now);
      },
      supported: (value) => this.offerSupported(trait, value),
    };
  }

  private completeChildren(
    trait: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ): AuthoredTraitOfferTraits {
    return completeCarrierChildren(this.childContext(trait), trait, value);
  }

  /** Picks the finding's child of an offer this walk authored again. */
  repickCarrierChild(trait: TraitOfferAddress, origin: SemanticAddress): boolean {
    const value = this.authoredOffers.get(semanticAddressKey(trait));
    if (value === undefined) return false;
    const key = `repick:${semanticAddressKey(origin)}`;
    if (this.context.hooked.has(key)) return false;
    this.context.hooked.add(key);
    const repicked = completeCarrierChildren(
      this.childContext(trait),
      trait,
      value,
      semanticAddressKey(origin),
    );
    return (
      this.offerSupported(trait, repicked) && this.context.apply(offerCommand(trait, repicked))
    );
  }

  /** Never an exchange row, a trait-removing Duo or a draft-illegal trait. */
  private monotonicSelection(trait: TraitOfferAddress, value: AuthoredTraitOfferTraits): boolean {
    const index = OPTION_KEYS.indexOf(value.selectedOptionKey);
    const selected = value.options[index];
    if (selected === undefined) return false;
    const declaration = this.catalog.traits.byKey[selected.traitKey];
    if (declaration === undefined || draftIllegalTrait(declaration)) return false;
    const evaluation = this.context.evaluate({ kind: 'traitOffer', trait, value });
    return (
      evaluation.kind === 'traitOffer' &&
      evaluation.result.assessments[index]?.replacementTransition === undefined
    );
  }

  /**
   * A core slot holding a basket trait takes no other trait, and no trait outside the basket is
   * taken while a basket trait it would keep from being offered is still to come.
   */
  private basketAllows(traitKey: string | undefined): boolean {
    if (traitKey === undefined) return false;
    const excluded = this.excludes.get(traitKey);
    if (excluded !== undefined) {
      const held = this.context.steering.progress().equippedTraitKeys;
      if (excluded.some((key) => !held.includes(key))) return false;
    }
    const slot = this.catalog.traits.byKey[traitKey]?.equipmentSlot;
    if (slot === undefined || slot === 'Spell') return true;
    const reserved = this.context.steering.basket.filter(
      (key) => this.catalog.traits.byKey[key]?.equipmentSlot === slot,
    );
    return reserved.length === 0 || reserved.includes(traitKey);
  }

  private accepts(command: ProjectCommand): boolean {
    try {
      applyProjectCommand(this.context.project(), this.catalog, command);
      return true;
    } catch (error) {
      if (error instanceof ProjectCommandContractError) return false;
      throw error;
    }
  }

  author(trait: TraitOfferAddress): boolean {
    const command = (value: AuthoredTraitOffer) => offerCommand(trait, value);
    for (const giver of this.context.shuffle(this.catalog.traitGivers.values)) {
      if (giver.providerKind === 'olympian' && !this.context.steering.inWorld(giver.key)) continue;
      const draft = this.context.startingOutcome(trait, giver.key);
      // The command binds one provider to this address; its starting outcome is accepted.
      if (draft === undefined || !this.accepts(command(draft))) continue;
      const values = draft.kind === 'traits' ? this.steerTraitOffer(trait, draft) : [draft];
      if (values.length === 0) {
        const reserved =
          draft.kind === 'traits' &&
          draft.options.some((option) => !this.basketAllows(option.traitKey));
        this.context.fail(
          `${reserved ? 'noLegalRowBasketReserved' : 'noLegalRow'} at ${semanticAddressKey(trait)} from ${giver.key}`,
        );
        return false;
      }
      for (const value of values) {
        const filled = value.kind === 'traits' ? this.randomFiller(trait, value) : undefined;
        if (filled !== undefined && this.context.apply(command(filled))) {
          this.authoredOffers.set(semanticAddressKey(trait), filled);
          return true;
        }
        if (this.context.apply(command(value))) {
          if (value.kind === 'traits') this.authoredOffers.set(semanticAddressKey(trait), value);
          return true;
        }
      }
    }
    return false;
  }

  /**
   * The unselected rows redrawn at random among supported ones. Under Denial,
   * which bans them, they keep clear of wanted basket traits unless nothing else fits.
   */
  private randomFiller(
    trait: TraitOfferAddress,
    value: AuthoredTraitOfferTraits,
  ): AuthoredTraitOfferTraits {
    const giver = this.catalog.traitGivers.byKey[value.giverKey];
    if (giver === undefined) return value;
    const steering = this.context.steering;
    const avoided = new Set(
      this.denial && giver.denialParticipates === true
        ? steering.wantedBasket(steering.progress())
        : [],
    );
    const selected = OPTION_KEYS.indexOf(value.selectedOptionKey);
    let current = value;
    for (const index of this.context.shuffle([...value.options.keys()])) {
      if (index === selected) continue;
      const row = current.options[index]!;
      const offered = new Set(current.options.map((option) => option.traitKey));
      const pool = this.context
        .shuffle(giver.traitKeys)
        .filter((key) => !offered.has(key) && !avoided.has(key));
      // A row already clear of the reserve is redrawn only from a few draws.
      for (const traitKey of pool.slice(
        0,
        avoided.has(row.traitKey) ? pool.length : FILLER_DRAWS,
      )) {
        const declaration = this.catalog.traits.byKey[traitKey];
        const rarities =
          declaration?.rarityDomain.kind === 'ranked'
            ? [
                ...(row.rarity === undefined ? [] : [row.rarity]),
                ...this.context
                  .shuffle(declaration.rarityDomain.freshOfferRarities)
                  .filter((rarity) => rarity !== row.rarity),
              ]
            : [undefined];
        const candidate = rarities
          .map((rarity) => {
            const options = [...current.options];
            options[index] = rarity === undefined ? { traitKey } : { traitKey, rarity };
            return {
              ...current,
              options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
            } as AuthoredTraitOfferTraits;
          })
          .reduce<AuthoredTraitOfferTraits | undefined>((found, offer) => {
            if (found !== undefined) return found;
            const complete = this.completeChildren(trait, offer);
            return this.offerSupported(trait, complete) ? complete : undefined;
          }, undefined);
        if (candidate !== undefined) {
          current = candidate;
          break;
        }
      }
    }
    return current;
  }

  /**
   * Wanted basket placements first, then every other legal row in random order.
   * A god offers its next queued trait, a hosted Duo included; its later traits wait, and a Duo
   * hosted by another god is never its row.
   */
  private steerTraitOffer(
    trait: TraitOfferAddress,
    draft: AuthoredTraitOfferTraits,
  ): AuthoredTraitOfferTraits[] {
    const select = (options: readonly AuthoredTraitOption[], index: number) => {
      const traitKey = options[index]!.traitKey;
      const hexTree = this.catalog.hexes.byKey[traitKey]
        ? createDefaultAuthoredHexTree(this.catalog, traitKey)
        : undefined;
      const { hexTree: _hexTree, ...rest } = draft;
      void _hexTree;
      return {
        ...rest,
        options: options as AuthoredTraitOfferTraits['options'],
        selectedOptionKey: OPTION_KEYS[index]!,
        ...(hexTree === undefined ? {} : { hexTree }),
      } as AuthoredTraitOfferTraits;
    };
    const legal = (candidate: AuthoredTraitOfferTraits) =>
      this.basketAllows(
        candidate.options[OPTION_KEYS.indexOf(candidate.selectedOptionKey)]?.traitKey,
      ) &&
      this.offerSupported(trait, candidate) &&
      this.monotonicSelection(trait, candidate);
    const indexes = [...draft.options.keys()];
    const giverTraits = this.catalog.traitGivers.byKey[draft.giverKey]?.traitKeys ?? [];
    const steering = this.context.steering;
    const progress = steering.progress();
    const prerequisites = steering.neededPrerequisites(progress);
    // Prerequisites of other wanted traits first, so waiting traits clear soonest; under
    // Denial a wanted trait already offered comes first, since leaving it would ban it.
    const offered = (key: string) =>
      Number(this.denial && draft.options.some((option) => option.traitKey === key));
    const providerKind = this.catalog.traitGivers.byKey[draft.giverKey]?.providerKind;
    const olympian = providerKind === 'olympian';
    // Gods, Hermes and Hammers offer their next queued basket trait only.
    const queued = olympian || providerKind === 'hermes' || providerKind === 'hammer';
    const next = queued ? steering.nextQueued(draft.giverKey, progress) : undefined;
    const wanted = queued
      ? next === undefined
        ? []
        : [next]
      : this.context
          .shuffle(steering.wantedBasket(progress).filter((key) => giverTraits.includes(key)))
          .sort(
            (a, b) =>
              offered(b) - offered(a) ||
              Number(prerequisites.has(b)) - Number(prerequisites.has(a)),
          );
    const wantedNow = steering.wantedBasket(progress);
    // A fallback row never jumps a god's queue nor takes another god's hosted Duo.
    const fallbackAllowed = (candidate: AuthoredTraitOfferTraits) => {
      const key = candidate.options[OPTION_KEYS.indexOf(candidate.selectedOptionKey)]?.traitKey;
      const owner = key === undefined ? undefined : steering.queueGiver(key);
      return (
        key !== undefined &&
        (!olympian || owner === undefined || owner === draft.giverKey) &&
        steering.orderAllows(key, progress)
      );
    };
    for (const traitKey of wanted) {
      const declaration = this.catalog.traits.byKey[traitKey];
      const rarities =
        declaration?.rarityDomain.kind === 'ranked'
          ? this.context.shuffle(declaration.rarityDomain.freshOfferRarities)
          : [undefined];
      for (const index of this.context.shuffle(indexes))
        for (const rarity of rarities) {
          const options = [...draft.options];
          options[index] = rarity === undefined ? { traitKey } : { traitKey, rarity };
          const candidate = this.completeChildren(trait, select(options, index));
          if (legal(candidate)) return [candidate];
        }
    }
    const rows = this.context
      .shuffle(indexes)
      .map((index) => this.completeChildren(trait, select(draft.options, index)))
      .filter((candidate) => fallbackAllowed(candidate) && legal(candidate));
    if (rows.length > 0) return rows;
    // Every offered row waits in a queue or is banned, so another of the giver's traits takes a row.
    const substitutes = this.context
      .shuffle(giverTraits)
      .filter((key) => !wantedNow.includes(key) && this.basketAllows(key))
      .slice(0, SUBSTITUTE_DRAWS);
    for (const traitKey of substitutes) {
      const declaration = this.catalog.traits.byKey[traitKey];
      const rarities =
        declaration?.rarityDomain.kind === 'ranked'
          ? this.context.shuffle(declaration.rarityDomain.freshOfferRarities)
          : [undefined];
      for (const index of this.context.shuffle(indexes))
        for (const rarity of rarities) {
          const options = [...draft.options];
          options[index] = rarity === undefined ? { traitKey } : { traitKey, rarity };
          const candidate = this.completeChildren(trait, select(options, index));
          if (legal(candidate)) return [candidate];
        }
    }
    return [];
  }
}

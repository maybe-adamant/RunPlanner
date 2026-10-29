import type { Catalog, DirectTraitSetKey } from '../../catalog-schema';
import {
  discoverAuthoredTraitCarrierChildren,
  optionIndex,
  semanticAddressKey,
  updateAuthoredTraitCarrierChild,
  type AuthoredAllTogetherResult,
  type AuthoredCirceResolution,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredTraitCarrierChild,
  type AuthoredTraitOfferTraits,
  type AuthoredTraitOption,
  type OneToEight,
  type TraitOfferAddress,
} from '../../authored-project';
import type {
  EvaluatedDirectTraitOutcomeCandidate,
  TraitCarrierChildDomainEvaluation,
  TraitCarrierChildDomainQuery,
} from '../candidates/trait-offer/query';

/** What the walk lends the child pass: engine domains, its rng and its steering. */
export interface DraftCarrierChildContext {
  readonly catalog: Catalog;
  readonly evaluate: (query: TraitCarrierChildDomainQuery) => TraitCarrierChildDomainEvaluation;
  readonly shuffle: <T>(values: readonly T[]) => T[];
  /** A trait a child would add to the run: Echo's replayed boon or Stone's residual row. */
  readonly allowsTrait: (traitKey: string) => boolean;
  readonly prefersTrait: (traitKey: string) => boolean;
  /** The complete offer is supported with no finding. */
  readonly supported: (value: AuthoredTraitOfferTraits) => boolean;
}

type Child<K extends AuthoredTraitCarrierChild['kind']> = Extract<
  AuthoredTraitCarrierChild,
  { readonly kind: K }
>;

/** Every child an offer can raise is at most a few nested picks deep. */
const MAX_CHILD_PICKS = 16;

const childKey = (child: AuthoredTraitCarrierChild) =>
  `${child.kind}:${semanticAddressKey(child.address)}`;

const possible = <T>(candidates: readonly EvaluatedDirectTraitOutcomeCandidate<T>[]): T[] =>
  candidates.filter((candidate) => candidate.support !== 'impossible').map((c) => c.value);

/**
 * Authors every selected-outcome child the offer raises with a random value from
 * its engine domain. `redo` names a child address to clear and pick again.
 */
export function completeCarrierChildren(
  context: DraftCarrierChildContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
  redo?: string,
): AuthoredTraitOfferTraits {
  let current =
    redo === undefined ? value : withoutCarrierChild(context.catalog, trait, value, redo);
  const settled = new Set<string>();
  for (let pick = 0; pick < MAX_CHILD_PICKS; pick += 1) {
    const child = discoverAuthoredTraitCarrierChildren(context.catalog, trait, current).find(
      (candidate) =>
        !candidate.authoredComplete &&
        candidate.kind !== 'hexTree' &&
        !settled.has(childKey(candidate)),
    );
    if (child === undefined) return current;
    const next = completeCarrierChild(context, trait, current, child);
    if (next === undefined) return current;
    if (next === current) settled.add(childKey(child));
    current = next;
  }
  return current;
}

/** The option field each option-owned child is stored in. */
const CHILD_FIELDS: Readonly<
  Record<
    Exclude<AuthoredTraitCarrierChild['kind'], 'hexTree' | 'concaveStone'>,
    keyof AuthoredTraitOption
  >
> = {
  traitAcquisitionTarget: 'targetTraitKey',
  latestModelTargets: 'icarusHammerTargets',
  allTogetherSet: 'allTogetherResult',
  naturalSelectionResult: 'naturalSelectionTargets',
  circeResolution: 'circeResolution',
  echoPomTarget: 'echoPomTarget',
  echoLastRunBoon: 'echoLastRunBoon',
};

/** The offer without the children at one child address, so they can be picked again. */
export function withoutCarrierChild(
  catalog: Catalog,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
  redo: string,
): AuthoredTraitOfferTraits {
  let current = value;
  for (const child of discoverAuthoredTraitCarrierChildren(catalog, trait, value)) {
    if (semanticAddressKey(child.address) !== redo || child.kind === 'hexTree') continue;
    if (child.kind === 'concaveStone') {
      const { concaveStoneResult: _result, ...rest } = current;
      void _result;
      current = rest;
      continue;
    }
    const field = CHILD_FIELDS[child.kind];
    const options = current.options.map((option, index) => {
      if (index !== optionIndex(child.optionKey)) return option;
      const cleared = { ...option };
      delete cleared[field];
      return cleared;
    });
    current = {
      ...current,
      options: Object.freeze(options) as AuthoredTraitOfferTraits['options'],
    };
  }
  return current;
}

/**
 * Authors one child with a random value from its engine domain; undefined when
 * the domain offers none, the offer itself when the child may stay unresolved.
 */
export function completeCarrierChild(
  context: DraftCarrierChildContext,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
  child: AuthoredTraitCarrierChild,
): AuthoredTraitOfferTraits | undefined {
  const domain = (current: AuthoredTraitOfferTraits, of: AuthoredTraitCarrierChild = child) =>
    context.evaluate({ kind: 'traitCarrierChildDomain', trait, value: current, child: of });
  switch (child.kind) {
    case 'traitAcquisitionTarget': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'traitAcquisitionTargetDomain') return undefined;
      const targetTraitKey = context.shuffle(
        evaluated.result.candidates.filter((c) => c.result.supported).map((c) => c.result.traitKey),
      )[0];
      return targetTraitKey === undefined
        ? undefined
        : updateAuthoredTraitCarrierChild(value, { kind: child.kind, child, targetTraitKey });
    }
    case 'latestModelTargets':
      return latestModel(context, value, child, domain);
    case 'allTogetherSet': {
      const sets = discoverAuthoredTraitCarrierChildren(context.catalog, trait, value).filter(
        (candidate): candidate is Child<'allTogetherSet'> =>
          candidate.kind === 'allTogetherSet' && candidate.optionKey === child.optionKey,
      );
      const result: Partial<Record<DirectTraitSetKey, string | null>> = {};
      for (const set of sets) {
        const evaluated = domain(value, set);
        if (evaluated.kind !== 'allTogetherSetDomain') return undefined;
        const values = context.shuffle(possible(evaluated.result.candidates));
        if (values.length === 0) return undefined;
        result[set.setKey] = values[0]!;
      }
      return updateAuthoredTraitCarrierChild(value, {
        kind: child.kind,
        child,
        allTogetherResult: Object.freeze(result) as AuthoredAllTogetherResult,
      });
    }
    case 'naturalSelectionResult': {
      let current = value;
      const targets: string[] = [];
      for (let level = 0; level <= child.slotCount; level += 1) {
        const evaluated = domain(current);
        if (evaluated.kind !== 'naturalSelectionResult') return undefined;
        if (targets.length > 0 && evaluated.result.complete) return current;
        const next = context.shuffle(evaluated.result.nextTargetTraitKeys)[0];
        if (next === undefined) return undefined;
        targets.push(next);
        current = updateAuthoredTraitCarrierChild(current, {
          kind: child.kind,
          child,
          targets: Object.freeze([...targets]) as unknown as OneToEight<string>,
        });
      }
      return undefined;
    }
    case 'circeResolution': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'circeResolutionDomain') return undefined;
      const { effect, requiredCount, arcanaCandidates, vowCandidates } = evaluated.result;
      const keys = context
        .shuffle(possible(effect === 'disableFear' ? vowCandidates : arcanaCandidates))
        .slice(0, requiredCount);
      if (keys.length < requiredCount) return undefined;
      const resolution: AuthoredCirceResolution =
        effect === 'disableFear'
          ? { kind: effect, vowKeys: Object.freeze(keys) }
          : { kind: effect, arcanaKeys: Object.freeze(keys) };
      return updateAuthoredTraitCarrierChild(value, {
        kind: child.kind,
        child,
        value: Object.freeze(resolution),
      });
    }
    case 'echoPomTarget': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'echoPomTargetDomain') return undefined;
      const values = context.shuffle(possible(evaluated.result.candidates));
      return values.length === 0
        ? undefined
        : updateAuthoredTraitCarrierChild(value, { kind: child.kind, child, value: values[0]! });
    }
    case 'echoLastRunBoon':
      return echoLastRunBoon(context, value, child, domain);
    case 'concaveStone': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'concaveStone') return undefined;
      const branches = evaluated.result.branches;
      // Below a certain proc the Stone may stay unresolved.
      if (!branches.some((branch) => branch.required)) return value;
      const residual = (branches[0]?.residualOptionKeys ?? []).filter((key) =>
        branches.every((branch) => branch.residualOptionKeys.includes(key)),
      );
      const traitOf = (key: (typeof residual)[number]) =>
        value.options[optionIndex(key)]?.traitKey ?? '';
      const ordered = context
        .shuffle(residual.filter((key) => context.allowsTrait(traitOf(key))))
        .sort(
          (a, b) =>
            Number(context.prefersTrait(traitOf(b))) - Number(context.prefersTrait(traitOf(a))),
        );
      for (const optionKey of ordered) {
        const proc = updateAuthoredTraitCarrierChild(value, {
          kind: 'concaveStone',
          child,
          value: Object.freeze({ kind: 'proc', optionKey }),
        });
        const complete = completeCarrierChildren(context, trait, proc);
        if (context.supported(complete)) return complete;
      }
      return undefined;
    }
    case 'hexTree':
      return value;
  }
}

/** Latest Model's Hammers, one row at a time from the first. */
function latestModel(
  context: DraftCarrierChildContext,
  value: AuthoredTraitOfferTraits,
  child: Child<'latestModelTargets'>,
  domain: (current: AuthoredTraitOfferTraits) => TraitCarrierChildDomainEvaluation,
): AuthoredTraitOfferTraits | undefined {
  let current = value;
  for (let row = 0; row < 3; row += 1) {
    const evaluated = domain(current);
    if (evaluated.kind !== 'latestModelTargetsDomain') return undefined;
    const held = current.options[optionIndex(child.optionKey)]?.icarusHammerTargets ?? [];
    if (held.length > 0 && held.length >= evaluated.result.requiredCount) return current;
    const domainRow = evaluated.result.rows[held.length];
    if (domainRow === undefined) return undefined;
    const supported = new Set(
      evaluated.result.candidates.filter((c) => c.result.supported).map((c) => c.result.traitKey),
    );
    const traitKey = context.shuffle(
      domainRow.availableTargetTraitKeys.filter((key) => supported.has(key)),
    )[0];
    const targets = traitKey === undefined ? undefined : domainRow.valueByTraitKey[traitKey];
    if (targets === undefined) return undefined;
    current = updateAuthoredTraitCarrierChild(current, {
      kind: 'latestModelTargets',
      child,
      icarusHammerTargets: targets,
    });
  }
  return undefined;
}

/** Boon Boon Boon as one replayed row, then its own target or nested carrier. */
function echoLastRunBoon(
  context: DraftCarrierChildContext,
  value: AuthoredTraitOfferTraits,
  child: Child<'echoLastRunBoon'>,
  domain: (current: AuthoredTraitOfferTraits) => TraitCarrierChildDomainEvaluation,
): AuthoredTraitOfferTraits | undefined {
  const evaluated = domain(value);
  if (evaluated.kind !== 'echoLastRunBoonDomain') return undefined;
  const candidates = context
    .shuffle(
      evaluated.result.candidates.filter(
        (candidate) =>
          candidate.support !== 'impossible' && context.allowsTrait(candidate.option.traitKey),
      ),
    )
    .sort(
      (a, b) =>
        Number(context.prefersTrait(b.option.traitKey)) -
        Number(context.prefersTrait(a.option.traitKey)),
    );
  for (const candidate of candidates) {
    let row: AuthoredEchoLastRunBoonOption = candidate.option;
    if (candidate.targetRequired) {
      const target = context.shuffle(possible(candidate.targetCandidates))[0];
      if (target === undefined) continue;
      row = { ...row, targetTraitKey: target };
    }
    const write = (option: AuthoredEchoLastRunBoonOption) =>
      updateAuthoredTraitCarrierChild(value, {
        kind: 'echoLastRunBoon',
        child,
        value: Object.freeze({
          options: Object.freeze([Object.freeze(option)]),
          selectedOptionKey: 'option1',
        }) as AuthoredEchoLastRunBoonOffer,
      });
    let current = write(row);
    for (let pick = 0; pick < MAX_CHILD_PICKS; pick += 1) {
      const nested = domain(current);
      if (nested.kind !== 'echoLastRunBoonDomain') break;
      const carrier = nested.result.selectedCarrier;
      if (carrier === undefined || carrier.complete) return current;
      if (carrier.kind === 'allTogether') {
        const result: Partial<Record<DirectTraitSetKey, string | null>> = {};
        for (const set of carrier.sets) {
          const values = context.shuffle(possible(set.candidates));
          if (values.length === 0) break;
          result[set.setKey] = values[0]!;
        }
        if (Object.keys(result).length !== carrier.sets.length) break;
        row = { ...row, allTogetherResult: Object.freeze(result) as AuthoredAllTogetherResult };
      } else {
        const next = context.shuffle(possible(carrier.nextTargetCandidates))[0];
        if (next === undefined) break;
        row = {
          ...row,
          naturalSelectionTargets: Object.freeze([
            ...(row.naturalSelectionTargets ?? []),
            next,
          ]) as unknown as OneToEight<string>,
        };
      }
      current = write(row);
    }
  }
  return undefined;
}

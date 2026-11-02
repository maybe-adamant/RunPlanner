import type { Catalog, DirectTraitSetKey } from '../../../catalog-schema';
import {
  semanticAddressKey,
  type SemanticAddress,
  type TraitOfferAddress,
} from '../../../authored-project/addresses';
import {
  discoverAuthoredTraitCarrierChildren,
  updateAuthoredTraitCarrierChild,
  withoutTraitCarrierChild,
  type AuthoredTraitCarrierChild,
} from '../../../authored-project/traits/carrier-children';
import {
  optionIndex,
  type AuthoredAllTogetherResult,
  type AuthoredCirceResolution,
  type AuthoredEchoLastRunBoonOffer,
  type AuthoredEchoLastRunBoonOption,
  type AuthoredTraitOfferTraits,
  type OneToEight,
} from '../../../authored-project/traits/state';
import type { ProjectCandidateSession } from '../session';
import type {
  EvaluatedDirectTraitOutcomeCandidate,
  TraitCarrierChildDomainEvaluation,
} from './query';

/** How a consumer chooses among the values a carrier child's engine domain allows. */
export interface CarrierChildChoice {
  /** Orders a domain's possible values; completion takes the first that settles. */
  readonly order: <T>(values: readonly T[]) => readonly T[];
  /** Whether a child may add this trait to the run: Echo's replayed boon, a Concave Stone residual row. */
  readonly allowsTrait: (traitKey: string) => boolean;
  readonly prefersTrait: (traitKey: string) => boolean;
}

/** Each domain's values in engine order, every trait allowed, none preferred. */
export const FIRST_ELIGIBLE_CARRIER_CHILD_CHOICE: CarrierChildChoice = Object.freeze({
  order: <T>(values: readonly T[]) => [...values],
  allowsTrait: () => true,
  prefersTrait: () => false,
});

type Child<K extends AuthoredTraitCarrierChild['kind']> = Extract<
  AuthoredTraitCarrierChild,
  { readonly kind: K }
>;

type ChildDomain = (
  current: AuthoredTraitOfferTraits,
  of?: AuthoredTraitCarrierChild,
) => TraitCarrierChildDomainEvaluation;

/** Every child an offer can raise is at most a few nested picks deep. */
const MAX_CHILD_PICKS = 16;

const childKey = (child: AuthoredTraitCarrierChild) =>
  `${child.kind}:${semanticAddressKey(child.address)}`;

const possible = <T>(candidates: readonly EvaluatedDirectTraitOutcomeCandidate<T>[]): T[] =>
  candidates.filter((candidate) => candidate.support !== 'impossible').map((c) => c.value);

/** Preferred values first, otherwise in the choice's order. */
const preferredFirst = <T>(
  choice: CarrierChildChoice,
  values: readonly T[],
  traitOf: (value: T) => string,
): T[] =>
  [...choice.order(values)].sort(
    (a, b) => Number(choice.prefersTrait(traitOf(b))) - Number(choice.prefersTrait(traitOf(a))),
  );

/** The complete offer is supported with no finding. */
function offerSupported(
  candidates: ProjectCandidateSession,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
): boolean {
  const evaluation = candidates.evaluate({ kind: 'traitOffer', trait, value });
  return (
    evaluation.kind === 'traitOffer' &&
    evaluation.result.supported &&
    evaluation.result.findings.length === 0
  );
}

/**
 * Authors every selected-outcome child the offer raises with the first chosen
 * value its engine domain settles. `redo` names a child to clear and author again.
 */
export function completeTraitCarrierChildren(
  catalog: Catalog,
  candidates: ProjectCandidateSession,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
  choice: CarrierChildChoice,
  redo?: SemanticAddress,
): AuthoredTraitOfferTraits {
  let current = redo === undefined ? value : withoutTraitCarrierChild(catalog, trait, value, redo);
  const settled = new Set<string>();
  for (let pick = 0; pick < MAX_CHILD_PICKS; pick += 1) {
    const child = discoverAuthoredTraitCarrierChildren(catalog, trait, current).find(
      (candidate) =>
        !candidate.authoredComplete &&
        candidate.kind !== 'hexTree' &&
        !settled.has(childKey(candidate)),
    );
    if (child === undefined) return current;
    const next = completeTraitCarrierChild(catalog, candidates, trait, current, child, choice);
    if (next === undefined) return current;
    if (next === current) settled.add(childKey(child));
    current = next;
  }
  return current;
}

/**
 * Authors one child with the first chosen value from its engine domain;
 * undefined when the domain offers none, the offer itself when the child may
 * stay unresolved.
 */
export function completeTraitCarrierChild(
  catalog: Catalog,
  candidates: ProjectCandidateSession,
  trait: TraitOfferAddress,
  value: AuthoredTraitOfferTraits,
  child: AuthoredTraitCarrierChild,
  choice: CarrierChildChoice,
): AuthoredTraitOfferTraits | undefined {
  const domain: ChildDomain = (current, of = child) =>
    candidates.evaluate({ kind: 'traitCarrierChildDomain', trait, value: current, child: of });
  switch (child.kind) {
    case 'traitAcquisitionTarget': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'traitAcquisitionTargetDomain') return undefined;
      const targetTraitKey = choice.order(
        evaluated.result.candidates.filter((c) => c.result.supported).map((c) => c.result.traitKey),
      )[0];
      return targetTraitKey === undefined
        ? undefined
        : updateAuthoredTraitCarrierChild(value, { kind: child.kind, child, targetTraitKey });
    }
    case 'latestModelTargets':
      return latestModel(choice, value, child, domain);
    case 'allTogetherSet': {
      const sets = discoverAuthoredTraitCarrierChildren(catalog, trait, value).filter(
        (candidate): candidate is Child<'allTogetherSet'> =>
          candidate.kind === 'allTogetherSet' && candidate.optionKey === child.optionKey,
      );
      const result: Partial<Record<DirectTraitSetKey, string | null>> = {};
      for (const set of sets) {
        const evaluated = domain(value, set);
        if (evaluated.kind !== 'allTogetherSetDomain') return undefined;
        const values = choice.order(possible(evaluated.result.candidates));
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
        const next = choice.order(evaluated.result.nextTargetTraitKeys)[0];
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
      const keys = choice
        .order(possible(effect === 'disableFear' ? vowCandidates : arcanaCandidates))
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
      const values = choice.order(possible(evaluated.result.candidates));
      return values.length === 0
        ? undefined
        : updateAuthoredTraitCarrierChild(value, { kind: child.kind, child, value: values[0]! });
    }
    case 'echoLastRunBoon':
      return echoLastRunBoon(choice, value, child, domain);
    case 'concaveStone': {
      const evaluated = domain(value);
      if (evaluated.kind !== 'concaveStone') return undefined;
      const stone = evaluated.result.stone;
      // Below a certain proc the Stone may stay unresolved.
      if (stone?.required !== true) return value;
      const residual = stone.residualOptionKeys;
      const traitOf = (key: (typeof residual)[number]) =>
        value.options[optionIndex(key)]?.traitKey ?? '';
      const ordered = preferredFirst(
        choice,
        residual.filter((key) => choice.allowsTrait(traitOf(key))),
        traitOf,
      );
      for (const optionKey of ordered) {
        const proc = updateAuthoredTraitCarrierChild(value, {
          kind: 'concaveStone',
          child,
          value: Object.freeze({ kind: 'proc', optionKey }),
        });
        const complete = completeTraitCarrierChildren(catalog, candidates, trait, proc, choice);
        if (offerSupported(candidates, trait, complete)) return complete;
      }
      return undefined;
    }
    case 'hexTree':
      return value;
  }
}

/** Latest Model's Hammers, one row at a time from the first. */
function latestModel(
  choice: CarrierChildChoice,
  value: AuthoredTraitOfferTraits,
  child: Child<'latestModelTargets'>,
  domain: ChildDomain,
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
    const traitKey = choice.order(
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
  choice: CarrierChildChoice,
  value: AuthoredTraitOfferTraits,
  child: Child<'echoLastRunBoon'>,
  domain: ChildDomain,
): AuthoredTraitOfferTraits | undefined {
  const evaluated = domain(value);
  if (evaluated.kind !== 'echoLastRunBoonDomain') return undefined;
  const candidates = preferredFirst(
    choice,
    evaluated.result.candidates.filter(
      (candidate) =>
        candidate.support !== 'impossible' && choice.allowsTrait(candidate.option.traitKey),
    ),
    (candidate) => candidate.option.traitKey,
  );
  for (const candidate of candidates) {
    let row: AuthoredEchoLastRunBoonOption = candidate.option;
    if (candidate.targetRequired) {
      const target = choice.order(possible(candidate.targetCandidates))[0];
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
          const values = choice.order(possible(set.candidates));
          if (values.length === 0) break;
          result[set.setKey] = values[0]!;
        }
        if (Object.keys(result).length !== carrier.sets.length) break;
        row = { ...row, allTogetherResult: Object.freeze(result) as AuthoredAllTogetherResult };
      } else {
        const next = choice.order(possible(carrier.nextTargetCandidates))[0];
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

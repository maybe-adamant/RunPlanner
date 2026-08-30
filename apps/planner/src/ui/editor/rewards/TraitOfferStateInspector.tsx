import type { TraitOfferStatePresentation } from '@planner/projections/traitProjection';

export function TraitOfferStateInspector({
  presentation,
}: {
  readonly presentation: TraitOfferStatePresentation;
}) {
  return (
    <details className="trait-offer-state-inspector">
      <summary>Offer State</summary>
      <p className="trait-offer-state-note">
        Rarity values are ordered roll checks, not final outcome odds.
      </p>
      <div className="trait-offer-state-list">
        {presentation.states.map((state, index) => (
          <section
            aria-label={
              presentation.states.length === 1
                ? 'Offer generation state'
                : `Possible state ${index + 1}`
            }
            className="trait-offer-state"
            key={`${state.replacementChance}:${JSON.stringify(state.rarity)}:${index}`}
          >
            {presentation.states.length === 1 ? null : <h3>Possible state {index + 1}</h3>}
            {state.rarity.kind === 'fixed' ? (
              <p>
                Fresh rarity: <strong>Fixed {state.rarity.rarity}</strong>
              </p>
            ) : (
              <dl className="trait-offer-state-values" aria-label="Rarity roll checks">
                {state.rarity.checks.map((check) => (
                  <div key={check.label}>
                    <dt>{check.label}</dt>
                    <dd>{check.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            <dl className="trait-offer-state-replacement">
              <div>
                <dt>Replacement chance</dt>
                <dd>{state.replacementChance}</dd>
              </div>
              <div>
                <dt>Eligible replacement traits</dt>
                <dd>{state.eligibleReplacementCount}</dd>
              </div>
              <div>
                <dt>Allowed replacements</dt>
                <dd>{state.maximumReplacementCount}</dd>
              </div>
              <div>
                <dt>Required replacements</dt>
                <dd>{state.requiredReplacementCount}</dd>
              </div>
              <div>
                <dt>Required by forced roll</dt>
                <dd>{state.forcedRollRequiredReplacementCount}</dd>
              </div>
              <div>
                <dt>Required by shortage</dt>
                <dd>{state.shortageRequiredReplacementCount}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </details>
  );
}

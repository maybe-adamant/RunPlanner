import * as Popover from '@radix-ui/react-popover';
import { useCallback, useState } from 'react';

import type { TraitOfferStatePresentation } from '@planner/projections/rewards/traitProjection';
import { EditorDialogTitleAction } from '@planner/ui/controls/EditorDialog';

/** The offer's generation state, opened from an info button on the dialog's title line. */
export function TraitOfferStateInspector({
  presentation,
}: {
  readonly presentation: TraitOfferStatePresentation;
}) {
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const captureTrigger = useCallback((node: HTMLElement | null): void => {
    const container = node?.closest<HTMLElement>('dialog') ?? null;
    setPortalContainer((current) => (current === container ? current : container));
  }, []);
  return (
    <EditorDialogTitleAction>
      <Popover.Root>
        <Popover.Trigger asChild ref={captureTrigger}>
          <button aria-label="Offer state" className="trait-offer-state-button" type="button">
            i
          </button>
        </Popover.Trigger>
        <Popover.Portal container={portalContainer ?? undefined}>
          <Popover.Content
            align="end"
            aria-label="Offer state"
            className="trait-offer-state-popover"
            collisionPadding={12}
            side="bottom"
            sideOffset={6}
          >
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
                  key={`${JSON.stringify(state.rarity)}:${index}`}
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
                </section>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </EditorDialogTitleAction>
  );
}

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
            <section aria-label="Offer generation state" className="trait-offer-state">
              {presentation.rarity.kind === 'fixed' ? (
                <p>
                  Fresh rarity: <strong>Fixed {presentation.rarity.rarity}</strong>
                </p>
              ) : (
                <dl className="trait-offer-state-values" aria-label="Rarity roll checks">
                  {presentation.rarity.checks.map((check) => (
                    <div key={check.label}>
                      <dt>{check.label}</dt>
                      <dd>{check.value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </EditorDialogTitleAction>
  );
}

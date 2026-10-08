import {
  optionIndex,
  type AuthoredAnvilResult,
  type AuthoredLevelResolution,
  type AuthoredTraitOffer,
} from '@run-planner/engine/authored-project';
import type { Catalog, TraitGiverDeclaration } from '@run-planner/engine/catalog-schema';

import type { WorkspaceLauncherPresentation } from '../contracts/traits';

/** The detail appears only when a chosen value exists to restate in full. */
function presentation(label: string, detail?: string): WorkspaceLauncherPresentation {
  return Object.freeze(detail === undefined ? { label } : { label, detail });
}

function traitLabel(catalog: Catalog, traitKey: string): string {
  return catalog.traits.byKey[traitKey]?.label ?? traitKey;
}

/** `Edit Trait`, `Edit Hex` or `Edit Chaos`, valued by the chosen outcome. */
export function traitOfferLauncherPresentation(
  catalog: Catalog,
  giver: TraitGiverDeclaration,
  offer: AuthoredTraitOffer | null,
): WorkspaceLauncherPresentation {
  if (giver.providerKind === 'chaos') {
    if (offer?.kind !== 'chaos') return presentation('Edit Chaos · Choose outcome');
    const curseKey = offer.curseOptions[optionIndex(offer.selectedOptionKey)]?.curseKey;
    const curse =
      curseKey === undefined
        ? 'no curse'
        : (catalog.chaos.curses.byKey[curseKey]?.label ?? curseKey);
    const blessing = catalog.chaos.blessings.byKey[offer.blessingKey]?.label ?? offer.blessingKey;
    return presentation(
      `Edit Chaos · ${curse} → ${blessing}`,
      `${curse} → ${blessing} · ${offer.rarity}`,
    );
  }
  const kind = giver.providerKind === 'spell' ? 'Hex' : 'Trait';
  if (offer?.kind === 'fallbackGold') return presentation(`Edit ${kind} · Fallback Gold`);
  const selected =
    offer?.kind === 'traits' ? offer.options[optionIndex(offer.selectedOptionKey)] : undefined;
  if (selected === undefined)
    return presentation(`Edit ${kind} · Choose ${kind === 'Hex' ? 'Hex' : 'trait'}`);
  const label = traitLabel(catalog, selected.traitKey);
  return presentation(
    `Edit ${kind} · ${label}`,
    `${giver.label}: ${label}${selected.rarity === undefined ? '' : ` · ${selected.rarity}`}`,
  );
}

/** `Edit Pom`, valued by its target and the levels it grants. */
export function levelResolutionLauncherPresentation(
  catalog: Catalog,
  value: AuthoredLevelResolution,
  levelCount: number | undefined,
  settledEmptyNoOp: boolean,
): WorkspaceLauncherPresentation {
  if (settledEmptyNoOp) return presentation('Edit Pom · No eligible traits');
  const target = value.kind === 'choice' ? value.selectedTraitKey : value.targetTraitKey;
  const levels = levelCount === undefined ? '' : ` +${levelCount}`;
  if (target === null) return presentation(`Edit Pom · Choose target${levels}`);
  const label = traitLabel(catalog, target);
  return presentation(
    `Edit Pom · ${label}${levels}`,
    `${label}${
      levelCount === undefined ? '' : ` gains ${levelCount} level${levelCount === 1 ? '' : 's'}`
    }`,
  );
}

/** `Edit Anvil` carries no value; its removal and additions live in the summary. */
export function anvilResultLauncherPresentation(
  catalog: Catalog,
  value: AuthoredAnvilResult | null,
): WorkspaceLauncherPresentation {
  if (value === null) return presentation('Edit Anvil');
  const removed =
    value.removedTraitKey === null
      ? 'No removal'
      : `Removes ${traitLabel(catalog, value.removedTraitKey)}`;
  const added = value.addedTraitKeys.map((traitKey) => traitLabel(catalog, traitKey)).join(', ');
  return presentation('Edit Anvil', `${removed} · adds ${added || 'nothing'}`);
}

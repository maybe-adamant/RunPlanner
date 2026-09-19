import { assessPublicDreamItinerary } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { ContextualPickerItem, ContextualPickerModel } from './contextual/contextualPicker';

export interface DreamItineraryDraftProjection {
  readonly biomeCount: number;
  readonly complete: boolean;
  readonly badges: readonly {
    readonly index: number;
    readonly label: string;
    readonly selected: boolean;
  }[];
  readonly picker: ContextualPickerModel<string>;
}

function explanation(
  reason: 'initialBiomeRequired' | 'duplicateBiome' | 'naturalSuccessor' | undefined,
  previousBiomeLabel: string | undefined,
): string | undefined {
  if (reason === 'duplicateBiome') return 'Already included in this route.';
  if (reason === 'initialBiomeRequired') return 'Cannot be the first biome in a Dream Dive.';
  if (reason === 'naturalSuccessor') {
    return `Normally follows ${previousBiomeLabel}; Dream Dives require a different next biome.`;
  }
  return undefined;
}

/** Adapts the engine-owned Dream legality product into the creation dialog. */
export function projectDreamItineraryDraft(
  catalog: Catalog,
  draft: readonly string[],
  stage: number,
): DreamItineraryDraftProjection {
  const completeAssessment = assessPublicDreamItinerary(catalog, draft);
  const assessment = assessPublicDreamItinerary(catalog, draft.slice(0, stage));
  const selectedBiomeKey = draft[stage];
  const items: readonly ContextualPickerItem<string>[] = assessment.nextChoices.map((choice) => {
    const biome = catalog.biomes.byKey[choice.biomeKey];
    if (biome === undefined) throw new Error(`Unknown Dream itinerary biome ${choice.biomeKey}`);
    const item = {
      key: choice.biomeKey,
      value: choice.biomeKey,
      label: biome.label,
      state: choice.legal ? ('possible' as const) : ('impossible' as const),
      selected: choice.biomeKey === selectedBiomeKey,
      disabled: !choice.legal,
    } satisfies ContextualPickerItem<string>;
    const previousBiomeKey = draft[stage - 1];
    const detail = explanation(
      choice.reason,
      previousBiomeKey === undefined ? undefined : catalog.biomes.byKey[previousBiomeKey]?.label,
    );
    return detail === undefined
      ? Object.freeze(item)
      : Object.freeze({ ...item, explanation: detail });
  });
  const selected = items.find((item) => item.selected);
  return Object.freeze({
    biomeCount: assessment.biomeCount,
    complete: completeAssessment.legal,
    badges: Object.freeze(
      Array.from({ length: assessment.biomeCount }, (_, index) => {
        const biomeKey = draft[index];
        const biome = biomeKey === undefined ? undefined : catalog.biomes.byKey[biomeKey];
        return Object.freeze({
          index,
          label:
            biome === undefined ? `${index + 1}. Choose biome` : `${index + 1}. ${biome.label}`,
          selected: biome !== undefined,
        });
      }),
    ),
    picker: Object.freeze({
      ...(selected === undefined ? {} : { selected }),
      sections: Object.freeze([
        Object.freeze({
          key: 'dream-biomes',
          kind: 'category' as const,
          label: 'Available biomes',
          collapsible: false,
          items: Object.freeze(
            catalog.biomes.values.flatMap((biome) => {
              const item = items.find((candidate) => candidate.value === biome.key);
              return item !== undefined && !item.disabled ? [item] : [];
            }),
          ),
        }),
        ...(items.some((item) => item.disabled)
          ? [
              Object.freeze({
                key: 'unavailable',
                kind: 'unavailable' as const,
                label: 'Unavailable',
                collapsible: true,
                items: Object.freeze(items.filter((item) => item.disabled)),
              }),
            ]
          : []),
      ]),
    }),
  });
}

/** Revising an earlier badge retains only the still-legal contiguous suffix. */
export function replaceDreamItineraryDraftBiome(
  catalog: Catalog,
  draft: readonly string[],
  stage: number,
  biomeKey: string,
): readonly string[] {
  const next = [...draft.slice(0, stage), biomeKey];
  for (const retained of draft.slice(stage + 1)) {
    const retainedChoice = assessPublicDreamItinerary(catalog, next).nextChoices.find(
      (choice) => choice.biomeKey === retained,
    );
    if (retainedChoice?.legal !== true) break;
    next.push(retained);
  }
  return Object.freeze(next);
}

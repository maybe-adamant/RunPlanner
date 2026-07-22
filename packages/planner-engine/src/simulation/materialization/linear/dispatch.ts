import { type BiomeAddress } from '../../../authored-project/addresses';
import type { Catalog, LinearBiomeLayout } from '../../../catalog-schema';
import type { CompleteLinearCompletenessResult } from '../../completeness';
import { materializeClockworkBiome, materializeStandardLinearBiome } from './continuations';
import { fail } from './contract';
import type { CanonicalLinearBiome } from '../model';
import { assertAuthoredRoomTemplateSupported } from './rooms';

function requireLinearLayout(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteLinearCompletenessResult,
): LinearBiomeLayout {
  if ((completeness as { readonly completion?: unknown }).completion !== 'complete') {
    fail('linear materialization requires a complete biome result');
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  const supportedContinuation =
    layout?.kind === 'LinearBiome' &&
    ((layout.continuation.batchPolicy.kind === 'standard' &&
      (layout.continuation.rewardStorePolicy.kind === 'authoredBaseStore' ||
        (layout.continuation.progressionPolicy.kind === 'staged' &&
          layout.continuation.rewardStorePolicy.kind === 'none'))) ||
      (layout.continuation.batchPolicy.kind === 'fields' &&
        layout.continuation.rewardStorePolicy.kind === 'none') ||
      (layout.continuation.batchPolicy.kind === 'clockwork' &&
        layout.continuation.rewardStorePolicy.kind === 'none'));
  const supportedEntry =
    layout?.kind === 'LinearBiome' &&
    ((layout.start.kind === 'authoredStart' && layout.entries.length === 0) ||
      (layout.start.kind === 'fixedEntry' &&
        layout.entries.every((entry) => entry.kind === 'fixedEntry')));
  const supportedTerminal =
    layout?.kind === 'LinearBiome' &&
    ((layout.terminal.kind === 'forkedTransition' &&
      layout.continuation.batchPolicy.kind !== 'clockwork') ||
      (layout.terminal.kind === 'directTransition' &&
        layout.continuation.batchPolicy.kind === 'standard') ||
      (layout.terminal.kind === 'generatedTarget' &&
        layout.continuation.batchPolicy.kind === 'clockwork'));
  const supportedFields =
    layout?.kind === 'LinearBiome' &&
    (layout.continuation.batchPolicy.kind === 'clockwork'
      ? layout.fields.length === 1 &&
        layout.fields[0]?.key === 'maxNonGoalRewards' &&
        layout.fields[0].kind === 'boundedInteger'
      : layout.fields.length === 0);
  if (
    layout?.kind !== 'LinearBiome' ||
    !supportedEntry ||
    !supportedContinuation ||
    !supportedTerminal ||
    !supportedFields
  ) {
    fail(`catalog ${biome.biomeKey} layout is not supported by the canonical linear materializer`);
  }
  for (const room of catalog.rooms.values) {
    if (room.biomeKey === layout.biomeKey && room.mode.kind === 'authored') {
      assertAuthoredRoomTemplateSupported(room.mode.templateKey, room.gameName);
    }
  }
  return layout;
}

export function materializeLinearBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteLinearCompletenessResult,
): CanonicalLinearBiome {
  const layout = requireLinearLayout(catalog, biome, completeness);
  return layout.continuation.batchPolicy.kind === 'clockwork'
    ? materializeClockworkBiome(catalog, biome, layout, completeness)
    : materializeStandardLinearBiome(catalog, biome, layout, completeness);
}

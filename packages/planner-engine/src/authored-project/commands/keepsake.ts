import type { Catalog } from '../../catalog-schema';
import type { AuthoredKeepsakeEquipResults, ProjectDocument } from '../model';
import { failCommand, locateBiome, withBiome } from './contract';
import type { KeepsakeCommand, KeepsakeEquipResultCommand } from './types';

/**
 * Activates declaration-owned defaults for a newly selected keepsake without
 * overwriting an authored result retained while that keepsake was dormant.
 */
export function withDefaultKeepsakeEquipResult(
  catalog: Catalog,
  keepsakeKey: string,
  current: AuthoredKeepsakeEquipResults | undefined,
): AuthoredKeepsakeEquipResults | undefined {
  const effect = catalog.keepsakes.byKey[keepsakeKey]?.effect;
  if (effect?.kind !== 'jeweledPom' || current?.jeweledPom !== undefined) return current;
  const defaults = catalog.traitGivers.byKey[effect.giverKey]?.defaultOffer;
  if (defaults === undefined) throw new Error(`${effect.giverKey} has no default trait offer`);
  const selected = defaults.options[defaults.selectedOption];
  if (selected === undefined) throw new Error(`${effect.giverKey} has no selected default trait`);
  return Object.freeze({
    ...current,
    jeweledPom: Object.freeze({
      traitKey: selected.traitKey,
      ...(selected.rarity === undefined ? {} : { rarity: selected.rarity }),
    }),
  });
}

export function applyKeepsakeCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: KeepsakeCommand | KeepsakeEquipResultCommand,
): ProjectDocument {
  if (command.kind === 'ReplaceJeweledPomEquipResult') {
    const descriptor = catalog.keepsakes.values.find(
      (keepsake) => keepsake.effect?.kind === command.result.resultKind,
    )?.effect;
    if (descriptor === undefined)
      failCommand(command, `unknown keepsake result ${command.result.resultKind}`);
    if (!catalog.traitGivers.byKey[descriptor.giverKey]?.traitKeys.includes(command.value.traitKey))
      failCommand(
        command,
        `trait ${command.value.traitKey} is not owned by ${descriptor.giverKey}`,
      );
    const trait = catalog.traits.byKey[command.value.traitKey];
    if (trait === undefined) failCommand(command, `unknown trait ${command.value.traitKey}`);
    const rarityPolicy = catalog.traitGivers.byKey[descriptor.giverKey]?.rarityPolicy;
    if (rarityPolicy?.kind !== 'fixed')
      failCommand(command, `${descriptor.giverKey} must declare one fixed result rarity`);
    if (command.value.rarity !== undefined && command.value.rarity !== rarityPolicy.rarity)
      failCommand(
        command,
        `rarity ${command.value.rarity} does not match ${descriptor.giverKey}'s fixed rarity`,
      );
    const completeValue = Object.freeze({ ...command.value, rarity: rarityPolicy.rarity });
    const { selection } = command.result;
    if (selection.owner === 'routeStart') {
      const routeIndex = document.routes.findIndex(
        (route) => route.routeKey === selection.routeKey,
      );
      const route = document.routes[routeIndex];
      if (route === undefined) failCommand(command, 'unknown route');
      if (route.loadout.startingKeepsakeKey !== descriptorOwnerKey(catalog, descriptor))
        failCommand(command, 'result does not match the current selection');
      return {
        ...document,
        routes: document.routes.map((candidate, index) =>
          index !== routeIndex
            ? candidate
            : {
                ...route,
                loadout: {
                  ...route.loadout,
                  keepsakeEquipResults: {
                    ...route.loadout.keepsakeEquipResults,
                    jeweledPom: completeValue,
                  },
                },
              },
        ),
      };
    }
    const located = locateBiome(document, catalog, {
      kind: 'ReplacePostbossKeepsake',
      selection,
      value: { kind: 'retain' },
    });
    if (located.plan.postbossKeepsakeDisposition === undefined)
      failCommand(command, 'biome has no ordinary Postboss rack');
    if (
      located.plan.postbossKeepsakeDisposition.kind !== 'replace' ||
      located.plan.postbossKeepsakeDisposition.keepsakeKey !==
        descriptorOwnerKey(catalog, descriptor)
    )
      failCommand(command, 'result does not match the current selection');
    return withBiome(document, located, {
      ...located.plan,
      keepsakeEquipResults: { ...located.plan.keepsakeEquipResults, jeweledPom: completeValue },
    });
  }
  const located = locateBiome(document, catalog, command);
  if (command.selection.owner.biomeKey !== located.plan.biomeKey)
    failCommand(command, 'selection does not own this Postboss biome');
  if (located.plan.postbossKeepsakeDisposition === undefined)
    failCommand(command, 'biome has no ordinary Postboss rack');
  if (
    command.value.kind === 'replace' &&
    catalog.keepsakes.byKey[command.value.keepsakeKey] === undefined
  )
    failCommand(command, `unknown keepsake ${command.value.keepsakeKey}`);
  const keepsakeEquipResults =
    command.value.kind === 'replace'
      ? withDefaultKeepsakeEquipResult(
          catalog,
          command.value.keepsakeKey,
          located.plan.keepsakeEquipResults,
        )
      : located.plan.keepsakeEquipResults;
  return withBiome(document, located, {
    ...located.plan,
    postbossKeepsakeDisposition: command.value,
    ...(keepsakeEquipResults === undefined ? {} : { keepsakeEquipResults }),
  });
}

function descriptorOwnerKey(
  catalog: Catalog,
  descriptor: NonNullable<Catalog['keepsakes']['values'][number]['effect']>,
): string {
  const owner = catalog.keepsakes.values.find((keepsake) => keepsake.effect === descriptor);
  if (owner === undefined) throw new Error('keepsake descriptor has no owner');
  return owner.key;
}

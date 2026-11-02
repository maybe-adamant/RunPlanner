import { useState, type ReactNode } from 'react';
import {
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { workspaceInteractionKey } from '@planner/projections/structured-workspace';
import { KeepsakeSelectionLauncher } from '@planner/ui/editor/KeepsakePickers';
import { AspectHexTreeDialog } from '@planner/ui/editor/rewards/AspectHexTreeDialog';
import { useFindingTarget } from '../feedback/useFindingTarget';
import { RouteFamiliarPicker } from './RouteFamiliarPicker';
import { RouteWeaponPicker } from './RouteWeaponPicker';
import { fearVowsInGridOrder, maximumFear } from '@planner/ui/controls/arcana-fear/fearVowOrder';
import { useLoadoutPresets } from './loadoutPresetsContext';
import { LoadoutBoardDialog } from './LoadoutBoardDialog';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';

/** Weapon, Arcana, Fear, starting keepsake, Hex and familiar, edited as the project's loadout. */
export function RouteLoadoutControls({
  authoredRoute,
  beside,
  catalog,
  interactions,
  keepsakeUnavailableHint,
  workspaceRoute,
}: {
  readonly authoredRoute: ProjectDocument['route'];
  /** Shares the weapon's row, after the weapon. */
  readonly beside?: ReactNode;
  readonly catalog: Catalog;
  readonly interactions: WorkspaceInteractionCatalog;
  /** Dims starting keepsakes this panel can't use, with the reason. */
  readonly keepsakeUnavailableHint?: (keepsakeKey: string) => string | undefined;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const findingTarget = useFindingTarget();
  const weaponKey = authoredRoute.loadout.weaponKey;
  const aspectKey = authoredRoute.loadout.aspectKey;
  const weapon = weaponKey === null ? undefined : catalog.weapons.byKey[weaponKey];
  if (weapon === undefined || aspectKey === null)
    throw new Error(`Missing weapon ${String(weaponKey)}`);
  const familiarKey = authoredRoute.loadout.familiarKey;
  if (familiarKey === null) throw new Error('Missing familiar');
  const derivedLoadout = deriveRouteLoadout(catalog, authoredRoute.loadout);
  const fearVows = fearVowsInGridOrder(catalog);
  const presets = useLoadoutPresets();
  const fearRanks = authoredRoute.loadout.fearRanks;
  const activeFearCount = fearVows.filter((vow) => fearRanks[vow.key]! > 0).length;
  const startingKeepsake = createRouteStartKeepsakeSelectionAddress(workspaceRoute.routeKey);
  const keepsake = interactions.keepsakeSelections.get(workspaceInteractionKey(startingKeepsake));
  if (keepsake === undefined)
    throw new Error(`Missing starting keepsake interaction for ${workspaceRoute.routeKey}`);
  const equipResults = (
    ['jeweledPom', 'experimentalHammer', 'transcendentEmbryo'] as const
  ).flatMap((resultKind) => {
    const result = interactions.keepsakeEquipResults.get(
      workspaceInteractionKey(createKeepsakeEquipResultAddress(startingKeepsake, resultKind)),
    );
    return result === undefined ? [] : [result];
  });
  const [dialog, setDialog] = useState<'Arcana' | 'Fear' | 'Hex'>();
  const weaponPicker = (
    <RouteWeaponPicker
      catalog={catalog}
      id={`${workspaceRoute.routeKey}-weapon-aspect`}
      weaponKey={weapon.key}
      aspectKey={aspectKey}
      onSelect={(weaponKey, aspectKey) =>
        dispatch(
          authoredProjectCommandDispatched({
            kind: 'ReplaceRouteLoadout',
            route: createRouteAddress(workspaceRoute.routeKey),
            weaponKey,
            aspectKey,
          }),
        )
      }
    />
  );
  const hexLauncher =
    workspaceRoute.aspectHexTree === undefined ? null : (
      <div className="field-control field-control-inline loadout-dialog-launcher">
        <label htmlFor={`${workspaceRoute.routeKey}-aspect-hex`}>Sky Fall Hex</label>
        <button
          {...findingTarget(
            workspaceRoute.aspectHexTree.address,
            `${workspaceRoute.routeKey}-aspect-hex`,
          )}
          className="contextual-picker-trigger"
          type="button"
          aria-label="Edit Sky Fall Hex tree"
          aria-haspopup="dialog"
          onClick={() => setDialog('Hex')}
        >
          <span onMouseEnter={showTruncatedTitle}>
            {workspaceRoute.aspectHexTree.layoutLabel} tree
          </span>
        </button>
      </div>
    );
  return (
    <div className="route-loadout-panel">
      <div className="route-loadout-controls">
        {/* The weapon leads on its own row; every row's items share one width with the Draft racks. */}
        {beside === undefined ? (
          <div className="route-loadout-row">
            {weaponPicker}
            {hexLauncher}
          </div>
        ) : (
          <div className="route-loadout-lead-row">
            {/* The Hex belongs to the aspect, so it shares the weapon's cell. */}
            <div className="route-loadout-weapon-cell">
              {weaponPicker}
              {hexLauncher}
            </div>
            {beside}
          </div>
        )}
        <div className="route-loadout-row">
          <div className="field-control field-control-inline loadout-dialog-launcher">
            <label htmlFor={`${workspaceRoute.routeKey}-arcana`}>Starting Arcana</label>
            <button
              id={`${workspaceRoute.routeKey}-arcana`}
              className="contextual-picker-trigger"
              type="button"
              aria-label="Edit Arcana"
              aria-haspopup="dialog"
              onClick={() => setDialog('Arcana')}
            >
              <span onMouseEnter={showTruncatedTitle}>
                {derivedLoadout.activeArcanaKeys.length} active ·{' '}
                {derivedLoadout.startingArcanaGrasp.cost}/
                {derivedLoadout.startingArcanaGrasp.capacity} Grasp
              </span>
            </button>
          </div>
          <div className="field-control field-control-inline loadout-dialog-launcher">
            <label htmlFor={`${workspaceRoute.routeKey}-fear`}>Starting Fear</label>
            <button
              id={`${workspaceRoute.routeKey}-fear`}
              className="contextual-picker-trigger"
              type="button"
              aria-label="Edit Fear"
              aria-haspopup="dialog"
              onClick={() => setDialog('Fear')}
            >
              <span onMouseEnter={showTruncatedTitle}>
                {activeFearCount} active · {derivedLoadout.fearTotal}/{maximumFear(catalog)} Fear
              </span>
            </button>
          </div>
          <KeepsakeSelectionLauncher
            equipResults={equipResults}
            id={`${workspaceRoute.routeKey}-starting-keepsake`}
            interaction={keepsake}
            label="Starting keepsake"
            {...(keepsakeUnavailableHint === undefined
              ? {}
              : { unavailableHint: keepsakeUnavailableHint })}
          />
          <RouteFamiliarPicker
            catalog={catalog}
            familiarKey={familiarKey}
            id={`${workspaceRoute.routeKey}-familiar`}
            onSelect={(nextFamiliarKey) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceFamiliar',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  familiarKey: nextFamiliarKey,
                }),
              )
            }
          />
        </div>
      </div>
      {dialog === 'Hex' && workspaceRoute.aspectHexTree !== undefined ? (
        <AspectHexTreeDialog
          control={workspaceRoute.aspectHexTree}
          onClose={() => setDialog(undefined)}
          returnFocusId={`${workspaceRoute.routeKey}-aspect-hex`}
        />
      ) : null}
      {dialog === 'Arcana' || dialog === 'Fear' ? (
        <LoadoutBoardDialog
          board={dialog === 'Arcana' ? 'arcana' : 'fear'}
          catalog={catalog}
          loadout={authoredRoute.loadout}
          onClose={() => setDialog(undefined)}
          presets={presets.snapshot}
          rarityOf={(cardKey) =>
            workspaceRoute.startingArcana.find((active) => active.key === cardKey)?.rarity
          }
          returnFocusId={`${workspaceRoute.routeKey}-${dialog === 'Arcana' ? 'arcana' : 'fear'}`}
          routeKey={workspaceRoute.routeKey}
        />
      ) : null}
    </div>
  );
}

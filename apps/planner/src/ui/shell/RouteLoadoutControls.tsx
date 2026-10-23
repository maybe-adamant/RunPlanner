import { useState, type ReactNode } from 'react';
import {
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  authoredProjectCommandDispatched,
  authoredProjectCommandsDispatched,
} from '@planner/state/projectWorkspaceSlice';
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
import { ArcanaBoard, FearBoard } from '@planner/ui/controls/arcana-fear/ArcanaFearBoards';
import { fearVowsInGridOrder } from '@planner/ui/controls/arcana-fear/fearVowOrder';
import { PresetChips } from '@planner/ui/controls/arcana-fear/PresetChips';
import {
  projectArcanaPresetChips,
  projectVowPresetChips,
} from '@planner/projections/loadoutPresets';
import { useLoadoutPresets } from './loadoutPresetsContext';

import { EditorDialog } from '@planner/ui/controls/EditorDialog';
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
  const maximumFear = fearVows.reduce(
    (total, vow) => total + vow.incrementalFear.reduce((sum, fear) => sum + fear, 0),
    0,
  );
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
  const weaponCell = (
    <div className="route-loadout-weapon-cell">
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
      {workspaceRoute.aspectHexTree === undefined ? null : (
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
      )}
    </div>
  );
  return (
    <div className="route-loadout-panel">
      <div className="route-loadout-controls">
        {/* The Hex belongs to the aspect, so it shares the weapon's cell. */}
        {beside === undefined ? (
          weaponCell
        ) : (
          <div className="route-loadout-lead-row">
            {weaponCell}
            {beside}
          </div>
        )}
        {/* Arcana, Fear, Keepsake and Familiar share one width with the Draft racks. */}
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
                Arcana · {derivedLoadout.activeArcanaKeys.length} active ·{' '}
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
                Fear · {activeFearCount} active · {derivedLoadout.fearTotal}/{maximumFear} Fear
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
      {dialog === 'Arcana' ? (
        <EditorDialog
          eyebrow="Loadout"
          model={{ kind: 'live', onDone: () => setDialog(undefined) }}
          returnFocusId={`${workspaceRoute.routeKey}-arcana`}
          size="cards"
          title="Arcana"
        >
          {presets.snapshot.arcana.length === 0 ? null : (
            <PresetChips
              chips={projectArcanaPresetChips(
                catalog,
                workspaceRoute.routeKey,
                authoredRoute.loadout,
                presets.snapshot.arcana,
              )}
              label="Arcana presets"
              onApply={(commands) => dispatch(authoredProjectCommandsDispatched(commands))}
            />
          )}
          <ArcanaBoard
            catalog={catalog}
            derived={derivedLoadout}
            domain={workspaceRoute.loadoutEditDomain}
            onReplace={(arcanaKeys) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceManualArcanaSelection',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  arcanaKeys,
                }),
              )
            }
            rarityOf={(cardKey) =>
              workspaceRoute.startingArcana.find((active) => active.key === cardKey)?.rarity
            }
          />
        </EditorDialog>
      ) : null}
      {dialog === 'Fear' ? (
        <EditorDialog
          eyebrow="Loadout"
          model={{ kind: 'live', onDone: () => setDialog(undefined) }}
          returnFocusId={`${workspaceRoute.routeKey}-fear`}
          size="cards"
          title="Fear"
        >
          {presets.snapshot.vows.length === 0 ? null : (
            <PresetChips
              chips={projectVowPresetChips(
                catalog,
                workspaceRoute.routeKey,
                authoredRoute.loadout,
                presets.snapshot.vows,
              )}
              label="Vow presets"
              onApply={(commands) => dispatch(authoredProjectCommandsDispatched(commands))}
            />
          )}
          <FearBoard
            catalog={catalog}
            derived={derivedLoadout}
            domain={workspaceRoute.loadoutEditDomain}
            onRank={(vowKey, rank) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceFearVowRank',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  vowKey,
                  rank,
                }),
              )
            }
          />
        </EditorDialog>
      ) : null}
    </div>
  );
}

import { useState } from 'react';
import {
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createKeepsakeEquipResultAddress,
  deriveRouteLoadout,
  routeInitialProfile,
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
import {
  KeepsakeEquipResultPicker,
  KeepsakeSelectionPicker,
} from '@planner/ui/editor/KeepsakePickers';
import { AspectHexTreeDialog } from '@planner/ui/editor/rewards/AspectHexTreeDialog';
import { RewardControlEditor } from '@planner/ui/editor/rewards/RewardControlEditor';
import { useFindingAnchor, useFindingTarget } from '../feedback/useFindingTarget';
import { RouteFamiliarPicker } from './RouteFamiliarPicker';
import { RouteWeaponPicker } from './RouteWeaponPicker';
import { ArcanaCard } from '@planner/ui/controls/arcana-fear/ArcanaCard';
import { FearCard } from '@planner/ui/controls/arcana-fear/FearCard';

import { EditorDialog } from '@planner/ui/controls/EditorDialog';

const fearVowGridOrder = Object.freeze([
  'EnemyDamageShrineUpgrade',
  'EnemyHealthShrineUpgrade',
  'EnemyShieldShrineUpgrade',
  'EnemySpeedShrineUpgrade',
  'EnemyCountShrineUpgrade',
  'NextBiomeEnemyShrineUpgrade',
  'EnemyRespawnShrineUpgrade',
  'EnemyEliteShrineUpgrade',
  'HealingReductionShrineUpgrade',
  'ShopPricesShrineUpgrade',
  'MinibossCountShrineUpgrade',
  'BoonSkipShrineUpgrade',
  'BiomeSpeedShrineUpgrade',
  'LimitGraspShrineUpgrade',
  'BoonManaReserveShrineUpgrade',
  'BanUnpickedBoonsShrineUpgrade',
  'BossDifficultyShrineUpgrade',
] as const);

/** The starting choices; route-scoped findings anchor here. */
export function RouteLoadoutPanel({
  catalog,
  project,
  workspaceRoute,
  interactions,
}: {
  readonly catalog: Catalog;
  readonly project: ProjectDocument;
  readonly workspaceRoute: WorkspaceRoute;
  readonly interactions: WorkspaceInteractionCatalog;
}) {
  const findingAnchor = useFindingAnchor();
  const authoredRoute =
    project.route.routeKey === workspaceRoute.routeKey ? project.route : undefined;
  if (authoredRoute === undefined)
    throw new Error(`Missing authored route ${workspaceRoute.routeKey}`);
  const initialProfile = routeInitialProfile(catalog, workspaceRoute.routeKey);
  return (
    <section
      className="route-overview"
      {...findingAnchor(workspaceRoute.marker.address)}
      tabIndex={-1}
    >
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Loadout</h2>
      </header>
      {initialProfile.kind === 'freshFile' ? (
        <FreshFileLoadout catalog={catalog} fixedWeaponKey={initialProfile.fixedWeaponKey} />
      ) : (
        <MatureRouteLoadout
          authoredRoute={authoredRoute}
          catalog={catalog}
          interactions={interactions}
          workspaceRoute={workspaceRoute}
        />
      )}
    </section>
  );
}

/** A fresh profile's fixed weapon; Arcana, Fear, keepsake and starting reward do not exist there. */
function FreshFileLoadout({
  catalog,
  fixedWeaponKey,
}: {
  readonly catalog: Catalog;
  readonly fixedWeaponKey: string;
}) {
  const weapon = catalog.weapons.byKey[fixedWeaponKey];
  return (
    <div className="route-loadout-panel route-fixed-loadout">
      <dl aria-label="Fixed starting loadout" className="route-fixed-loadout-facts">
        <div>
          <dt>Weapon</dt>
          <dd>{weapon?.label ?? fixedWeaponKey}, no Aspect</dd>
        </div>
      </dl>
    </div>
  );
}

function MatureRouteLoadout({
  authoredRoute,
  catalog,
  interactions,
  workspaceRoute,
}: {
  readonly authoredRoute: ProjectDocument['route'];
  readonly catalog: Catalog;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const findingTarget = useFindingTarget();
  const startingReward = workspaceRoute.startingReward;
  if (startingReward === undefined)
    throw new Error(`Missing starting reward control for ${workspaceRoute.routeKey}`);
  const weaponKey = authoredRoute.loadout.weaponKey;
  const aspectKey = authoredRoute.loadout.aspectKey;
  const weapon = weaponKey === null ? undefined : catalog.weapons.byKey[weaponKey];
  if (weapon === undefined || aspectKey === null)
    throw new Error(`Missing weapon ${String(weaponKey)}`);
  const familiarKey = authoredRoute.loadout.familiarKey;
  if (familiarKey === null) throw new Error('Missing familiar');
  const derivedLoadout = deriveRouteLoadout(catalog, authoredRoute.loadout);
  const arcanaCards = catalog.arcanaCards.values;
  const fearVows = fearVowGridOrder.flatMap((key) => {
    const vow = catalog.fearVows.byKey[key];
    return vow === undefined ? [] : [vow];
  });
  const fearRanks = authoredRoute.loadout.fearRanks;
  const manualArcana = new Map(
    workspaceRoute.loadoutEditDomain.manualArcana.map((toggle) => [toggle.key, toggle]),
  );
  const vowRanks = new Map(workspaceRoute.loadoutEditDomain.fearVows.map((vow) => [vow.key, vow]));
  const activeFearCount = fearVows.filter((vow) => fearRanks[vow.key]! > 0).length;
  const maximumFear = fearVows.reduce(
    (total, vow) => total + vow.incrementalFear.reduce((sum, fear) => sum + fear, 0),
    0,
  );
  const startingKeepsake = createRouteStartKeepsakeSelectionAddress(workspaceRoute.routeKey);
  const keepsake = interactions.keepsakeSelections.get(workspaceInteractionKey(startingKeepsake));
  if (keepsake === undefined)
    throw new Error(`Missing starting keepsake interaction for ${workspaceRoute.routeKey}`);
  const pomAddress = createKeepsakeEquipResultAddress(startingKeepsake, 'jeweledPom');
  const pom = interactions.keepsakeEquipResults.get(workspaceInteractionKey(pomAddress)) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'jeweledPom' } }
      >
    | undefined;
  const experimentalHammerAddress = createKeepsakeEquipResultAddress(
    startingKeepsake,
    'experimentalHammer',
  );
  const experimentalHammer = interactions.keepsakeEquipResults.get(
    workspaceInteractionKey(experimentalHammerAddress),
  ) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'experimentalHammer' } }
      >
    | undefined;
  const transcendentEmbryoAddress = createKeepsakeEquipResultAddress(
    startingKeepsake,
    'transcendentEmbryo',
  );
  const transcendentEmbryo = interactions.keepsakeEquipResults.get(
    workspaceInteractionKey(transcendentEmbryoAddress),
  ) as
    | Extract<
        import('@planner/projections/structured-workspace').WorkspaceKeepsakeEquipResultInteraction,
        { readonly owner: { readonly resultKind: 'transcendentEmbryo' } }
      >
    | undefined;
  const [dialog, setDialog] = useState<'Arcana' | 'Fear' | 'Hex'>();
  return (
    <>
      <div className="route-loadout-panel">
        <div className="route-loadout-controls">
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
              Arcana · {derivedLoadout.activeArcanaKeys.length} active ·{' '}
              {derivedLoadout.startingArcanaGrasp.cost}/
              {derivedLoadout.startingArcanaGrasp.capacity} Grasp
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
              Fear · {activeFearCount} active · {derivedLoadout.fearTotal}/{maximumFear} Fear
            </button>
          </div>
          <div className="route-keepsake-controls">
            <KeepsakeSelectionPicker
              id={`${workspaceRoute.routeKey}-starting-keepsake`}
              interaction={keepsake}
              label="Starting keepsake"
            />
            {pom === undefined ? null : (
              <KeepsakeEquipResultPicker
                id={`${workspaceRoute.routeKey}-jeweled-pom`}
                interaction={pom}
              />
            )}
            {experimentalHammer === undefined ? null : (
              <KeepsakeEquipResultPicker
                id={`${workspaceRoute.routeKey}-experimental-hammer`}
                interaction={experimentalHammer}
              />
            )}
            {transcendentEmbryo === undefined ? null : (
              <KeepsakeEquipResultPicker
                id={`${workspaceRoute.routeKey}-transcendent-embryo`}
                interaction={transcendentEmbryo}
              />
            )}
          </div>
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
                {workspaceRoute.aspectHexTree.layoutLabel} tree
              </button>
            </div>
          )}
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
            <section
              role="group"
              aria-label={`Arcana, ${derivedLoadout.activeArcanaKeys.length} active`}
              className="route-loadout-section"
            >
              <div className="arcana-summary-line">
                <p className="route-loadout-summary">
                  Arcana{' '}
                  <span>
                    {derivedLoadout.activeArcanaKeys.length} active ·{' '}
                    {derivedLoadout.startingArcanaGrasp.cost} /{' '}
                    {derivedLoadout.startingArcanaGrasp.capacity} Grasp
                  </span>
                </p>
                <p className="arcana-legend">Grayscale: inactive · Color: active</p>
              </div>
              <div className="arcana-board">
                {arcanaCards.map((card) => {
                  const toggle = manualArcana.get(card.key);
                  const automatic = toggle === undefined;
                  const selected =
                    toggle?.selected ?? derivedLoadout.automaticArcanaKeys.includes(card.key);
                  // Deselecting stays available so an over-capacity selection can be repaired.
                  const exceedsGrasp =
                    toggle !== undefined && !toggle.selected && !toggle.grasp.legal;
                  return (
                    <ArcanaCard
                      key={card.key}
                      cardKey={card.key}
                      rarity={
                        workspaceRoute.startingArcana.find((active) => active.key === card.key)
                          ?.rarity
                      }
                      label={`${card.label}${automatic ? ' (automatic)' : ''}`}
                      data-automatic={automatic}
                      aria-pressed={selected}
                      disabled={automatic || exceedsGrasp}
                      type="button"
                      onClick={() => {
                        if (toggle === undefined) return;
                        dispatch(
                          authoredProjectCommandDispatched({
                            kind: 'ReplaceManualArcanaSelection',
                            route: createRouteAddress(workspaceRoute.routeKey),
                            arcanaKeys: toggle.arcanaKeys,
                          }),
                        );
                      }}
                      hint={
                        exceedsGrasp
                          ? `${toggle.grasp.cost} Grasp exceeds the starting capacity of ${toggle.grasp.capacity}.`
                          : automatic
                            ? 'Activates automatically when its conditions are met.'
                            : undefined
                      }
                    />
                  );
                })}
              </div>
            </section>
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
            <section
              role="group"
              aria-label={`Fear, ${derivedLoadout.fearTotal} total`}
              className="route-loadout-section"
            >
              <p className="route-loadout-summary">
                Fear <span>{derivedLoadout.fearTotal} total</span>
              </p>
              <p className="panel-description">Click to cycle ranks · Right-click to reset</p>
              <div className="fear-rank-list">
                {fearVows.map((vow) => {
                  const { rank, maximum, legalRanks } = vowRanks.get(vow.key)!;
                  const nextRank = rank >= maximum ? 0 : rank + 1;
                  const canAdvance = legalRanks.includes(nextRank);
                  const setRank = (value: number) => {
                    if (value === rank || !legalRanks.includes(value)) return;
                    dispatch(
                      authoredProjectCommandDispatched({
                        kind: 'ReplaceFearVowRank',
                        route: createRouteAddress(workspaceRoute.routeKey),
                        vowKey: vow.key,
                        rank: value,
                      }),
                    );
                  };
                  return (
                    <FearCard
                      key={vow.key}
                      vowKey={vow.key}
                      label={vow.label}
                      rank={rank}
                      maximum={maximum}
                      type="button"
                      className="fear-rank-control"
                      aria-label={`${vow.label}, rank ${rank} of ${maximum}`}
                      aria-disabled={!canAdvance}
                      data-active={rank > 0 || undefined}
                      hint={
                        canAdvance
                          ? undefined
                          : 'This rank would lower your starting Grasp below the cost of your chosen Arcana. Remove Arcana cards first.'
                      }
                      data-fear-vow-key={vow.key}
                      data-rival={vow.key === 'BossDifficultyShrineUpgrade' || undefined}
                      onClick={() => setRank(nextRank)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setRank(0);
                      }}
                    />
                  );
                })}
              </div>
            </section>
          </EditorDialog>
        ) : null}
      </div>
      <div className="route-configuration">
        <RewardControlEditor
          control={startingReward}
          idPrefix={`${workspaceRoute.routeKey}-starting-reward`}
          interactions={interactions}
          label="Starting reward"
        />
      </div>
    </>
  );
}

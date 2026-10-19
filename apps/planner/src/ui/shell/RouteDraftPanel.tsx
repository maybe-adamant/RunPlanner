import { useEffect, useMemo, useState } from 'react';
import {
  createRouteAddress,
  type AuthoredDraftSpec,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  draftRefusals,
  forcesGod,
  type DraftNpcOption,
  type DraftRefusal,
  type DraftTargetResult,
  type DraftWorldOptions,
} from '@run-planner/engine/simulation';

import {
  projectDraftBasket,
  projectDraftSpec,
  withDraftBasketTraitToggled,
  withDraftFieldNpcToggled,
  withDraftGodToggled,
  withDraftRackKeepsake,
  withDraftStoryNpcToggled,
  type DraftRackSlot,
} from '@planner/projections/draftSpec';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import type { DraftRunState } from '@planner/state/draftSessionSlice';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { npcArtwork } from '@planner/ui/artwork/npcs/npcArtwork';
import { traitGiverArtwork } from '@planner/ui/artwork/trait-givers/traitGiverArtwork';
import { KeepsakeLauncher, KeepsakeRackDialog } from '@planner/ui/controls/keepsakes/KeepsakeRack';
import { hintProps } from '@planner/ui/controls/hint';
import type { DraftRunController } from '@planner/workspace/draftRun';
import { DraftBasketDialog } from './DraftBasketDialog';
import { DraftCapCount } from './DraftCapCount';
import { RouteLoadoutControls } from './RouteLoadoutControls';
import { useCommonItemWidth } from './useCommonItemWidth';

/** Why a draft cannot start, when nothing else on the panel already shows it. */
function refusalHint(catalog: Catalog, refusal: DraftRefusal | undefined): string | undefined {
  if (refusal === undefined) return undefined;
  switch (refusal.kind) {
    case 'godStartingKeepsake':
      return `${catalog.keepsakes.byKey[refusal.keepsakeKey]?.label ?? refusal.keepsakeKey} brings in a god, so it can't start a draft.`;
    case 'rackKeepsake':
      return refusal.reason === 'forcesGod'
        ? `${catalog.keepsakes.byKey[refusal.keepsakeKey]?.label ?? refusal.keepsakeKey} brings in a god, so a rack can't take it.`
        : undefined;
    case 'invalidLoadout':
      return 'The loadout is not complete.';
    case 'tooFewGods':
      return `Choose at least ${refusal.minGods} gods.`;
    case 'basketTrait':
    case 'unknownTrait':
      return 'Remove the marked basket traits first.';
    default:
      return undefined;
  }
}

/** An NPC's trait-giver label; NPCs that give no traits have no catalog label beyond their key. */
function npcLabel(catalog: Catalog, npc: DraftNpcOption): string {
  return (
    (npc.giverKey === undefined ? undefined : catalog.traitGivers.byKey[npc.giverKey]?.label) ??
    npc.npcKey
  );
}

function targetLabel(
  catalog: Catalog,
  worldOptions: DraftWorldOptions,
  target: DraftTargetResult,
): string {
  const biome = target.biomeKey === undefined ? '' : catalog.biomes.byKey[target.biomeKey]?.label;
  switch (target.kind) {
    case 'basketTrait':
      return catalog.traits.byKey[target.key]?.label ?? target.key;
    case 'storyNpc':
    case 'fieldNpc': {
      const options = worldOptions.biomes.find((b) => b.biomeKey === target.biomeKey);
      const npc = [options?.storyNpc, ...(options?.fieldNpcs ?? [])].find(
        (candidate) => candidate?.npcKey === target.key,
      );
      return `${npc === undefined ? target.key : npcLabel(catalog, npc)} (${biome})`;
    }
    case 'rackKeepsake':
      return `${catalog.keepsakes.byKey[target.key]?.label ?? target.key} after ${biome}`;
  }
}

function useElapsedSeconds(run: DraftRunState): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.kind !== 'running') return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [run.kind]);
  return run.kind === 'running' ? Math.max(0, Math.floor((now - run.startedAt) / 1000)) : 0;
}

function DraftOutcome({
  catalog,
  run,
  worldOptions,
}: {
  readonly catalog: Catalog;
  readonly run: DraftRunState;
  readonly worldOptions: DraftWorldOptions;
}) {
  switch (run.kind) {
    case 'idle':
    case 'running':
      return null;
    case 'superseded':
      return (
        <p className="draft-outcome">The project changed while drafting; nothing was applied.</p>
      );
    case 'refused':
      return <p className="draft-outcome">This spec can't be drafted.</p>;
    case 'error':
      return <p className="draft-outcome">Drafting stopped unexpectedly.</p>;
    case 'failed':
      return (
        <p className="draft-outcome">
          No plan found
          {run.biomeKey === ''
            ? ''
            : ` in ${catalog.biomes.byKey[run.biomeKey]?.label ?? run.biomeKey}`}
          . Try another seed or a smaller basket.
        </p>
      );
    case 'drafted': {
      const unmet = run.report.targets.filter((target) => !target.met);
      return (
        <section aria-label="Draft report" className="draft-report">
          <p>
            {run.report.met} of {run.report.targets.length} targets met.
          </p>
          {unmet.length === 0 ? null : (
            <ul aria-label="Unmet targets" className="draft-chip-list">
              {unmet.map((target) => (
                <li
                  className="draft-chip"
                  data-unmet
                  key={`${target.kind}:${target.biomeKey ?? ''}:${target.key}`}
                >
                  {targetLabel(catalog, worldOptions, target)}
                </li>
              ))}
            </ul>
          )}
          {run.report.extras.length === 0 ? null : (
            <ul aria-label="Extras" className="draft-chip-list">
              {run.report.extras.map((extra) => (
                <li className="draft-chip" data-unmet key={`${extra.kind}:${extra.key}`}>
                  {catalog.traitGivers.byKey[extra.key]?.label ?? extra.key}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
  }
}

const godKeepsakeReason = "Drafting can't use god keepsakes.";

/** One Postboss rack's keepsake; it shows the keepsake held there, inherited or chosen. */
function DraftRackKeepsake({
  catalog,
  index,
  label,
  onSelect,
  slot,
}: {
  readonly catalog: Catalog;
  readonly index: number;
  readonly label: string;
  readonly onSelect: (keepsakeKey: string) => void;
  readonly slot: DraftRackSlot;
}) {
  const [open, setOpen] = useState(false);
  const id = `draft-rack-${index}`;
  const held = slot.effectiveKeepsakeKey;
  const heldLabel = held === null ? undefined : (catalog.keepsakes.byKey[held]?.label ?? held);
  return (
    <>
      <KeepsakeLauncher
        id={id}
        keepsakeKey={held ?? undefined}
        label={label}
        onOpen={() => setOpen(true)}
        text={
          heldLabel === undefined
            ? 'Choose keepsake'
            : slot.keepsakeKey === null
              ? `${heldLabel} (Unchanged)`
              : heldLabel
        }
      />
      {open ? (
        <KeepsakeRackDialog
          entries={catalog.keepsakes.values.map((keepsake) => {
            const allowed = slot.keepsakeKeys.includes(keepsake.key);
            return {
              key: keepsake.key,
              label: keepsake.label,
              selected: keepsake.key === held,
              disabled: !allowed,
              hint: allowed ? undefined : godKeepsakeReason,
            };
          })}
          onClose={() => setOpen(false)}
          onSelect={onSelect}
          returnFocusId={id}
          title={label}
        />
      ) : null}
    </>
  );
}

const npcIcon = (npcKey: string): string | undefined => npcArtwork[npcKey] ?? undefined;

/** Describes a world and basket; drafting fills the route's biomes and sets the loadout. */
export function RouteDraftPanel({
  catalog,
  draftRun,
  interactions,
  project,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly draftRun: DraftRunController;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly project: ProjectDocument;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const run = useAppSelector((state) => state.draftSession.run);
  const [basketOpen, setBasketOpen] = useState(false);
  // Racks line up under Arcana, Fear and Keepsake at one shared width.
  const rows = useCommonItemWidth<HTMLFieldSetElement>();
  const projection = useMemo(() => projectDraftSpec(catalog, project), [catalog, project]);
  const draft = project.route.draft;
  const replaceDraft = (next: AuthoredDraftSpec) =>
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceDraftSpec',
        route: createRouteAddress(project.route.routeKey),
        draft: next,
      }),
    );
  const { spec, worldOptions, rackSlots } = projection;
  const refusals = useMemo(
    () => (spec === undefined ? [] : draftRefusals(catalog, project, spec)),
    [catalog, project, spec],
  );
  const basket = useMemo(
    () =>
      spec === undefined ? undefined : projectDraftBasket(catalog, project, spec, worldOptions),
    [catalog, project, spec, worldOptions],
  );
  const running = run.kind === 'running';
  const elapsed = useElapsedSeconds(run);
  const godKeys = spec?.world.godKeys ?? [];
  const blocked = spec === undefined || refusals.length > 0;
  const draftHint =
    spec === undefined ? 'The loadout is not complete.' : refusalHint(catalog, refusals[0]);
  const overwrites = project.route.biomes.some((biome) => biome.topology !== null);
  const biomeLabel = (biomeKey: string) => catalog.biomes.byKey[biomeKey]?.label ?? biomeKey;
  const godKeepsakeHint = (keepsakeKey: string) =>
    forcesGod(catalog, keepsakeKey) ? godKeepsakeReason : undefined;
  return (
    <section className="route-overview route-draft" aria-label="Draft">
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Draft</h2>
      </header>
      <fieldset className="draft-fieldset" disabled={running} ref={rows}>
        <RouteLoadoutControls
          authoredRoute={project.route}
          catalog={catalog}
          interactions={interactions}
          keepsakeUnavailableHint={godKeepsakeHint}
          workspaceRoute={workspaceRoute}
        />
        <section
          className="draft-section draft-section-inline"
          aria-labelledby="draft-gods-heading"
        >
          <h3 className="draft-section-heading" id="draft-gods-heading">
            Gods{' '}
            <span>
              {godKeys.length}/{worldOptions.maxGods}
            </span>
          </h3>
          <div className="draft-toggle-row" role="group" aria-label="Gods">
            {worldOptions.godKeys.map((godKey) => {
              const selected = godKeys.includes(godKey);
              const full = !selected && godKeys.length >= worldOptions.maxGods;
              return (
                <button
                  aria-pressed={selected}
                  className="draft-toggle"
                  data-has-icon
                  disabled={full}
                  key={godKey}
                  onClick={() => replaceDraft(withDraftGodToggled(draft, godKey))}
                  type="button"
                >
                  <ArtworkIcon
                    className="draft-toggle-icon"
                    source={traitGiverArtwork[godKey] ?? undefined}
                  />
                  {catalog.traitGivers.byKey[godKey]?.label ?? godKey}
                </button>
              );
            })}
          </div>
        </section>
        <section className="draft-section" aria-labelledby="draft-npcs-heading">
          {/* The title shares the header row with the Story and Field column labels. */}
          <table className="draft-npc-table" aria-labelledby="draft-npcs-heading">
            <thead>
              <tr>
                <th scope="col">
                  <h3 className="draft-section-heading" id="draft-npcs-heading">
                    NPCs
                  </h3>
                </th>
                <th className="draft-section-heading" scope="col">
                  Story
                </th>
                <th className="draft-section-heading draft-npc-field" scope="col">
                  Field
                </th>
              </tr>
            </thead>
            <tbody>
              {worldOptions.biomes.map((biome) => {
                const storyNpc = biome.storyNpc;
                const label = biomeLabel(biome.biomeKey);
                return (
                  <tr key={biome.biomeKey}>
                    <th className="draft-npc-biome" scope="row">
                      {label}
                    </th>
                    <td>
                      {storyNpc === undefined ? null : (
                        <button
                          aria-label={`${npcLabel(catalog, storyNpc)}, story room in ${label}`}
                          aria-pressed={
                            spec?.world.storyNpcByBiome[biome.biomeKey] === storyNpc.npcKey
                          }
                          className="draft-toggle"
                          data-has-icon
                          onClick={() =>
                            replaceDraft(
                              withDraftStoryNpcToggled(draft, biome.biomeKey, storyNpc.npcKey),
                            )
                          }
                          type="button"
                        >
                          <ArtworkIcon
                            className="draft-toggle-icon"
                            source={npcIcon(storyNpc.npcKey)}
                          />
                          {npcLabel(catalog, storyNpc)}
                        </button>
                      )}
                    </td>
                    <td className="draft-npc-field">
                      <span className="draft-toggle-row">
                        {biome.fieldNpcs.map((npc) => (
                          <button
                            aria-label={`${npcLabel(catalog, npc)} in ${label}`}
                            aria-pressed={
                              spec?.world.fieldNpcsByBiome[biome.biomeKey]?.includes(npc.npcKey) ===
                              true
                            }
                            className="draft-toggle"
                            data-has-icon
                            key={npc.npcKey}
                            onClick={() =>
                              replaceDraft(
                                withDraftFieldNpcToggled(draft, biome.biomeKey, npc.npcKey),
                              )
                            }
                            type="button"
                          >
                            <ArtworkIcon
                              className="draft-toggle-icon"
                              source={npcIcon(npc.npcKey)}
                            />
                            {npcLabel(catalog, npc)}
                          </button>
                        ))}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
        {rackSlots.length === 0 ? null : (
          <section className="draft-section" aria-labelledby="draft-racks-heading">
            <h3 className="draft-section-heading" id="draft-racks-heading">
              Rack keepsakes
            </h3>
            <div className="route-loadout-row">
              {rackSlots.map((slot, index) => (
                <DraftRackKeepsake
                  catalog={catalog}
                  index={index}
                  key={`${slot.afterBiomeKey}-${index}`}
                  label={`After ${biomeLabel(slot.afterBiomeKey)}`}
                  onSelect={(keepsakeKey) =>
                    replaceDraft(withDraftRackKeepsake(draft, slot, keepsakeKey))
                  }
                  slot={slot}
                />
              ))}
            </div>
          </section>
        )}
        <section className="draft-section" aria-labelledby="draft-basket-heading">
          <div className="draft-section-header">
            <h3 className="draft-section-heading" id="draft-basket-heading">
              Basket
            </h3>
            <button
              aria-haspopup="dialog"
              className="secondary-action"
              disabled={basket === undefined}
              id="draft-basket-edit"
              onClick={() => setBasketOpen(true)}
              type="button"
            >
              Edit basket
            </button>
          </div>
          {basket === undefined ? null : (
            <ul aria-label="Basket caps" className="draft-cap-list">
              {basket.summary.map(({ key, label, cap }) => (
                <li key={key}>
                  {label}
                  <DraftCapCount cap={cap} />
                </li>
              ))}
            </ul>
          )}
          {basket === undefined || basket.chips.length === 0 ? null : (
            <ul aria-label="Basket traits" className="draft-chip-list">
              {basket.chips.map((chip) => (
                <li
                  className="draft-chip"
                  data-refused={chip.refused || undefined}
                  key={chip.traitKey}
                  {...hintProps(chip.refused ? chip.hint : undefined)}
                >
                  <span>{chip.label}</span>
                  <button
                    aria-label={`Remove ${chip.label}`}
                    className="draft-chip-remove"
                    onClick={() => replaceDraft(withDraftBasketTraitToggled(draft, chip.traitKey))}
                    type="button"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </fieldset>
      <div className="draft-actions">
        {overwrites ? (
          <p className="draft-warning" role="note">
            Drafting replaces the current route plan.
          </p>
        ) : null}
        <div className="draft-action-row">
          <span className="draft-seed">Seed {running ? run.seed : draft.seed}</span>
          {running ? (
            <>
              <span className="draft-progress">Drafting… {elapsed} s</span>
              <button className="secondary-action" onClick={() => draftRun.cancel()} type="button">
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                className="secondary-action"
                aria-disabled={blocked || undefined}
                onClick={() => {
                  if (!blocked) draftRun.reroll();
                }}
                type="button"
                {...hintProps(blocked ? draftHint : undefined)}
              >
                Reroll
              </button>
              <button
                className="primary-action"
                aria-disabled={blocked || undefined}
                onClick={() => {
                  if (!blocked) draftRun.draft();
                }}
                type="button"
                {...hintProps(blocked ? draftHint : undefined)}
              >
                Draft
              </button>
            </>
          )}
        </div>
        <DraftOutcome catalog={catalog} run={run} worldOptions={worldOptions} />
      </div>
      {basketOpen && basket !== undefined ? (
        <DraftBasketDialog
          onClose={() => setBasketOpen(false)}
          onToggle={(traitKey) => replaceDraft(withDraftBasketTraitToggled(draft, traitKey))}
          projection={basket}
          returnFocusId="draft-basket-edit"
        />
      ) : null}
    </section>
  );
}

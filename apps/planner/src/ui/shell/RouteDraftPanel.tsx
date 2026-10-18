import { useEffect, useMemo, useState } from 'react';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  draftRefusals,
  type DraftRefusal,
  type DraftTargetResult,
} from '@run-planner/engine/simulation';

import { declaredChoicesPicker } from '@planner/projections/contextual/contextualPicker';
import {
  projectDraftBasket,
  projectDraftSpec,
  type DraftBasketProjection,
  type DraftCapKey,
} from '@planner/projections/draftSpec';
import type {
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import {
  draftBasketTraitToggled,
  draftFieldNpcToggled,
  draftGodToggled,
  draftRackKeepsakeReplaced,
  draftStoryNpcToggled,
  type DraftRunState,
} from '@planner/state/draftSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import { ContextualPicker } from '@planner/ui/controls/ContextualPicker';
import { hintProps } from '@planner/ui/controls/hint';
import type { DraftRunController } from '@planner/workspace/draftRun';
import { DraftBasketDialog } from './DraftBasketDialog';
import { DraftCapCount, type DraftCapCounts } from './DraftCapCount';
import { RouteLoadoutControls } from './RouteLoadoutControls';

/** Why a draft cannot start, when nothing else on the panel already shows it. */
function refusalHint(catalog: Catalog, refusal: DraftRefusal | undefined): string | undefined {
  if (refusal === undefined) return undefined;
  switch (refusal.kind) {
    case 'godStartingKeepsake':
      return `${catalog.keepsakes.byKey[refusal.keepsakeKey]?.label ?? refusal.keepsakeKey} brings in a god, so it can't start a draft.`;
    case 'invalidLoadout':
      return 'The loadout is not complete.';
    case 'basketTrait':
    case 'unknownTrait':
      return 'Remove the marked basket traits first.';
    default:
      return undefined;
  }
}

function targetLabel(catalog: Catalog, target: DraftTargetResult): string {
  const biome = target.biomeKey === undefined ? '' : catalog.biomes.byKey[target.biomeKey]?.label;
  switch (target.kind) {
    case 'god':
      return catalog.traitGivers.byKey[target.key]?.label ?? target.key;
    case 'basketTrait':
      return catalog.traits.byKey[target.key]?.label ?? target.key;
    case 'storyNpc':
    case 'fieldNpc':
      return `${target.key} (${biome})`;
    case 'hammers':
      return `${target.key} Hammers`;
    case 'hermes':
      return `${target.key} Hermes boons`;
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
}: {
  readonly catalog: Catalog;
  readonly run: DraftRunState;
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
                  {targetLabel(catalog, target)}
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    }
  }
}

// Cap counts are not available yet; every count shows as a placeholder.
const capCounts: DraftCapCounts = () => undefined;

/** The panel summary: god boons, each bonus giver, then NPC traits. */
function basketCaps(
  basket: DraftBasketProjection,
): readonly { readonly key: string; readonly label: string; readonly cap: DraftCapKey }[] {
  const tab = (key: 'gods' | 'bonus' | 'npcs') => basket.tabs.find((t) => t.key === key);
  return [
    { key: 'gods', label: 'God boons', cap: { kind: 'godTotal' } },
    ...(tab('bonus')?.sections ?? []).flatMap((section) =>
      section.cap === undefined
        ? []
        : [{ key: section.key, label: section.label, cap: section.cap }],
    ),
    { key: 'npcs', label: 'NPCs', cap: { kind: 'npcTotal' } },
  ];
}

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
  const session = useAppSelector((state) => state.draftSession);
  const [basketOpen, setBasketOpen] = useState(false);
  const projection = useMemo(
    () => projectDraftSpec(catalog, project, session),
    [catalog, project, session],
  );
  const { spec, worldOptions, keepsakeOptions } = projection;
  const refusals = useMemo(
    () => (spec === undefined ? [] : draftRefusals(catalog, project, spec)),
    [catalog, project, spec],
  );
  const basket = useMemo(
    () =>
      spec === undefined ? undefined : projectDraftBasket(catalog, project, spec, worldOptions),
    [catalog, project, spec, worldOptions],
  );
  const run = session.run;
  const running = run.kind === 'running';
  const elapsed = useElapsedSeconds(run);
  const godKeys = spec?.world.godKeys ?? [];
  const blocked = spec === undefined || refusals.length > 0;
  const draftHint =
    spec === undefined ? 'The loadout is not complete.' : refusalHint(catalog, refusals[0]);
  const overwrites = project.route.biomes.some((biome) => biome.topology !== null);
  const biomeLabel = (biomeKey: string) => catalog.biomes.byKey[biomeKey]?.label ?? biomeKey;
  return (
    <section className="route-overview route-draft" aria-label="Draft">
      <header className="panel-heading">
        <h2 className="eyebrow route-loadout-heading">Draft</h2>
      </header>
      <fieldset className="draft-fieldset" disabled={running}>
        <RouteLoadoutControls
          authoredRoute={project.route}
          catalog={catalog}
          interactions={interactions}
          workspaceRoute={workspaceRoute}
        />
        <section className="draft-section" aria-labelledby="draft-gods-heading">
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
                  disabled={full}
                  key={godKey}
                  onClick={() => dispatch(draftGodToggled(godKey))}
                  type="button"
                >
                  {catalog.traitGivers.byKey[godKey]?.label ?? godKey}
                </button>
              );
            })}
          </div>
        </section>
        <section className="draft-section" aria-labelledby="draft-npcs-heading">
          <h3 className="draft-section-heading" id="draft-npcs-heading">
            NPCs
          </h3>
          <table className="draft-npc-table" aria-labelledby="draft-npcs-heading">
            <thead>
              <tr>
                <th scope="col">
                  <span className="visually-hidden">Biome</span>
                </th>
                <th scope="col">Story</th>
                <th scope="col">Field</th>
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
                          aria-label={`${storyNpc.npcKey}, story room in ${label}`}
                          aria-pressed={
                            spec?.world.storyNpcByBiome[biome.biomeKey] === storyNpc.npcKey
                          }
                          className="draft-toggle"
                          onClick={() =>
                            dispatch(
                              draftStoryNpcToggled({
                                biomeKey: biome.biomeKey,
                                npcKey: storyNpc.npcKey,
                              }),
                            )
                          }
                          type="button"
                        >
                          {storyNpc.npcKey}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className="draft-toggle-row">
                        {biome.fieldNpcs.map((npc) => (
                          <button
                            aria-label={`${npc.npcKey} in ${label}`}
                            aria-pressed={
                              spec?.world.fieldNpcsByBiome[biome.biomeKey]?.includes(npc.npcKey) ===
                              true
                            }
                            className="draft-toggle"
                            key={npc.npcKey}
                            onClick={() =>
                              dispatch(
                                draftFieldNpcToggled({
                                  biomeKey: biome.biomeKey,
                                  npcKey: npc.npcKey,
                                }),
                              )
                            }
                            type="button"
                          >
                            {npc.npcKey}
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
        {keepsakeOptions.rackSlots.length === 0 ? null : (
          <section
            className="draft-section route-loadout-controls"
            aria-labelledby="draft-racks-heading"
          >
            <h3 className="draft-section-heading" id="draft-racks-heading">
              Rack keepsakes
            </h3>
            {keepsakeOptions.rackSlots.map((slot, index) => {
              const selected = spec?.rackKeepsakeKeys[index] ?? null;
              return (
                <ContextualPicker
                  disabled={running}
                  id={`draft-rack-${index}`}
                  key={`${slot.afterBiomeKey}-${index}`}
                  label={`After ${biomeLabel(slot.afterBiomeKey)}`}
                  layout="inline"
                  model={declaredChoicesPicker<string | null>(
                    [
                      { key: '__keep', value: null, label: 'Keep current' },
                      ...slot.keepsakeKeys.map((key) => ({
                        key,
                        value: key,
                        label: catalog.keepsakes.byKey[key]?.label ?? key,
                      })),
                    ],
                    selected,
                  )}
                  onSelect={(keepsakeKey) =>
                    dispatch(draftRackKeepsakeReplaced({ index, keepsakeKey }))
                  }
                  placeholder="Keep current"
                  triggerLabel={
                    selected === null
                      ? 'Keep current'
                      : (catalog.keepsakes.byKey[selected]?.label ?? selected)
                  }
                />
              );
            })}
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
              {basketCaps(basket).map(({ key, label, cap }) => (
                <li key={key}>
                  {label}
                  <DraftCapCount cap={cap} counts={capCounts} label={label} />
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
                    onClick={() => dispatch(draftBasketTraitToggled(chip.traitKey))}
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
          <span className="draft-seed">Seed {running ? run.seed : session.seed}</span>
          {running ? (
            <>
              <span aria-live="polite" className="draft-progress">
                Drafting… {elapsed} s
              </span>
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
        <DraftOutcome catalog={catalog} run={run} />
      </div>
      {basketOpen && basket !== undefined ? (
        <DraftBasketDialog
          counts={capCounts}
          onClose={() => setBasketOpen(false)}
          onToggle={(traitKey) => dispatch(draftBasketTraitToggled(traitKey))}
          projection={basket}
          returnFocusId="draft-basket-edit"
        />
      ) : null}
    </section>
  );
}

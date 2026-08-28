import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createEchoLastRunBoonAddress,
  createOccurrenceId,
  createOccurrenceAddress,
  createProjectAddress,
  createRoomActionAddress,
  createRoomRunStateCheckpointAddress,
  createRouteAddress,
  createTraitOfferAddress,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog, RouteDeclaration } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  createEditorSessionReducer,
  editorSessionReconciled,
  findingSelected,
  routePanelSelected,
  routeSelected,
  runStateClosed,
  runStateOpened,
  semanticOwnerFocused,
  semanticOwnerNavigated,
  settingsSelected,
  traitOfferDialogOpened,
} from './editorSessionSlice';

const reducer = createEditorSessionReducer(catalog);

describe('editor session navigation', () => {
  it('derives route identity from the catalog instead of application route names', () => {
    const alternateRoute: RouteDeclaration = {
      key: 'Alternate',
      label: 'Alternate Route',
      biomeKeys: ['F'],
    };
    const alternateCatalog: Catalog = {
      ...catalog,
      routes: {
        values: [alternateRoute],
        byKey: { Alternate: alternateRoute },
      },
    };
    const alternateReducer = createEditorSessionReducer(alternateCatalog);
    const initial = alternateReducer(undefined, { type: 'test/initialize' });
    const selected = alternateReducer(
      initial,
      findingSelected({
        key: 'alternate-finding',
        origin: createBiomeAddress('Alternate', 'F'),
      }),
    );

    expect(initial.activeRouteKey).toBe('Alternate');
    expect(selected.activePanelByRoute.Alternate).toEqual({ kind: 'biome', biomeKey: 'F' });
  });

  it('seeds the first declared route and one tagged panel slot per declaration', () => {
    expect(reducer(undefined, { type: 'test/initialize' })).toEqual({
      activeRouteKey: 'Underworld',
      activePanelByRoute: { Underworld: { kind: 'overview' }, Surface: { kind: 'overview' } },
      focusedSemanticOwner: null,
      selectedFinding: null,
      semanticNavigationRevision: 0,
    });
  });

  it('keeps Run State open/close transient and clears it on navigation', () => {
    const owner = createRoomRunStateCheckpointAddress(
      createOccurrenceAddress(
        createBiomeAddress('Underworld', 'F'),
        createOccurrenceId('run-state'),
      ),
      { kind: 'beforeRoomExit' },
    );
    const opened = reducer(undefined, runStateOpened(owner));
    expect(opened.runStateTarget).toEqual(owner);
    expect(reducer(opened, runStateClosed()).runStateTarget).toBeNull();
    expect(reducer(opened, routeSelected('Surface')).runStateTarget).toBeNull();
  });

  it('starts explicit trait launcher visits at the outer offer after a BBB finding', () => {
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'H'),
        { kind: 'occurrence', occurrenceId: createOccurrenceId('echo') },
        'Encounter',
      ),
      'selection',
    );
    const child = createEchoLastRunBoonAddress(trait, 'option1');
    const fromFinding = reducer(
      undefined,
      findingSelected({ key: 'bbb-missing', origin: child, traitDialogTarget: trait }),
    );
    expect(fromFinding.focusedSemanticOwner).toEqual(child);
    expect(fromFinding.traitDialogTarget).toEqual(trait);

    const explicit = reducer(fromFinding, traitOfferDialogOpened(trait));
    expect(explicit.focusedSemanticOwner).toEqual(trait);
    expect(explicit.traitDialogTarget).toEqual(trait);
  });

  it('keeps an exact finding selected while focusing its visible timeline action', () => {
    const occurrence = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'F'),
      createOccurrenceId('pickup-context'),
    );
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        createBiomeAddress('Underworld', 'F'),
        { kind: 'occurrence', occurrenceId: occurrence.occurrenceId },
        'Encounter',
      ),
      'selection',
    );
    const action = createRoomActionAddress(
      createBiomeAddress('Underworld', 'F'),
      occurrence.occurrenceId,
      'interact:incoming',
    );
    const selected = reducer(
      undefined,
      findingSelected({
        focusAddress: action,
        key: 'pickup-trait-finding',
        origin: trait,
        traitDialogTarget: null,
      }),
    );

    expect(selected.selectedFinding?.origin).toEqual(trait);
    expect(selected.focusedSemanticOwner).toEqual(action);
    expect(selected.traitDialogTarget).toBeNull();
  });

  it('selects route panels without losing another route panel selection', () => {
    const underworld = reducer(
      undefined,
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'G' } }),
    );
    const surface = reducer(
      underworld,
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'npcIndex' } }),
    );
    const returned = reducer(surface, routeSelected('Underworld'));

    expect(returned.activeRouteKey).toBe('Underworld');
    expect(returned.activePanelByRoute).toEqual({
      Underworld: { kind: 'biome', biomeKey: 'G' },
      Surface: { kind: 'npcIndex' },
    });
  });

  it('routes biome and route findings through their semantic owner', () => {
    const settings = reducer(undefined, settingsSelected());
    const biomeSelection = {
      key: 'finding-key',
      origin: createBiomeAddress('Surface', 'O'),
    } as const;
    const selectedBiome = reducer(settings, findingSelected(biomeSelection));
    const selectedRoute = reducer(
      selectedBiome,
      findingSelected({ key: 'route-finding', origin: createRouteAddress('Underworld') }),
    );

    expect(selectedBiome.activeRouteKey).toBe('Surface');
    expect(selectedBiome.activePanelByRoute.Surface).toEqual({ kind: 'biome', biomeKey: 'O' });
    expect(selectedBiome.focusedSemanticOwner).toEqual(biomeSelection.origin);
    expect(selectedRoute.activeRouteKey).toBe('Underworld');
    expect(selectedRoute.activePanelByRoute.Underworld).toEqual({ kind: 'overview' });
  });

  it('issues a new navigation request when the same finding is selected again', () => {
    const selection = {
      key: 'finding-key',
      origin: createBiomeAddress('Underworld', 'F'),
    } as const;
    const selected = reducer(undefined, findingSelected(selection));
    const selectedAgain = reducer(selected, findingSelected(selection));

    expect(selectedAgain.selectedFinding).toBe(selection);
    expect(selectedAgain.semanticNavigationRevision).toBe(2);
  });

  it('navigates a semantic owner to its exact route and biome without selecting a finding', () => {
    const owner = createEncounterPhaseAddress(
      createBiomeAddress('Surface', 'N'),
      { kind: 'occurrence', occurrenceId: createOccurrenceId('npc-index-navigation') },
      'Encounter',
    );
    const finding = reducer(
      undefined,
      findingSelected({ key: 'selected-finding', origin: createBiomeAddress('Underworld', 'F') }),
    );
    const navigated = reducer(finding, semanticOwnerNavigated(owner));
    const navigatedAgain = reducer(navigated, semanticOwnerNavigated(owner));

    expect(navigated).toMatchObject({
      activeRouteKey: 'Surface',
      focusedSemanticOwner: owner,
      selectedFinding: null,
      semanticNavigationRevision: 2,
    });
    expect(navigated.activePanelByRoute.Surface).toEqual({ kind: 'biome', biomeKey: 'N' });
    expect(navigatedAgain.semanticNavigationRevision).toBe(3);
  });

  it('focuses a project-root finding without discarding the current editor location', () => {
    const biomePanel = reducer(
      undefined,
      routePanelSelected({
        routeKey: 'Underworld',
        panel: { kind: 'biome', biomeKey: 'F' },
      }),
    );
    const selection = { key: 'project-finding-key', origin: createProjectAddress() } as const;
    const selected = reducer(biomePanel, findingSelected(selection));

    expect(selected.activeRouteKey).toBe('Underworld');
    expect(selected.activePanelByRoute.Underworld).toEqual({ kind: 'biome', biomeKey: 'F' });
    expect(selected.selectedFinding).toBe(selection);
    expect(selected.focusedSemanticOwner).toEqual(selection.origin);
    expect(selected.semanticNavigationRevision).toBe(1);
  });

  it('keeps local semantic focus transient and clears it on panel navigation', () => {
    const owner = createBiomeAddress('Underworld', 'F');
    const finding = reducer(undefined, findingSelected({ key: 'selected-finding', origin: owner }));
    const focused = reducer(finding, semanticOwnerFocused(owner));
    const navigated = reducer(
      focused,
      routePanelSelected({
        routeKey: 'Underworld',
        panel: { kind: 'biome', biomeKey: 'F' },
      }),
    );

    expect(focused.focusedSemanticOwner).toEqual(owner);
    expect(focused.selectedFinding).toBeNull();
    expect(navigated.focusedSemanticOwner).toBeNull();
  });

  it('prunes only invalidated navigation references without changing editor location or revision', () => {
    const owner = createBiomeAddress('Underworld', 'F');
    const selected = reducer(
      undefined,
      findingSelected({ key: 'selected-finding', origin: owner }),
    );
    const reconciled = reducer(
      selected,
      editorSessionReconciled({ clearFocusedSemanticOwner: true, clearSelectedFinding: true }),
    );

    expect(reconciled).toMatchObject({
      activePanelByRoute: selected.activePanelByRoute,
      activeRouteKey: 'Underworld',
      semanticNavigationRevision: 1,
      focusedSemanticOwner: null,
      selectedFinding: null,
    });
  });

  it('rejects session addresses outside the declared route structure', () => {
    expect(() => reducer(undefined, routeSelected('Unknown'))).toThrow(
      'Editor navigation references unknown route Unknown',
    );
    expect(() =>
      reducer(
        undefined,
        routePanelSelected({
          routeKey: 'Underworld',
          panel: { kind: 'biome', biomeKey: 'N' },
        }),
      ),
    ).toThrow('Editor navigation references biome N outside route Underworld');
    expect(() =>
      reducer(undefined, semanticOwnerNavigated(createBiomeAddress('Underworld', 'N'))),
    ).toThrow('Editor navigation references biome N outside route Underworld');
  });
});

import {
  createBiomeAddress,
  createProjectAddress,
  createRouteAddress,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import type { Catalog, RouteDeclaration } from '@run-planner/engine/catalog-schema';
import { describe, expect, it } from 'vitest';

import {
  createEditorSessionReducer,
  findingSelected,
  routePanelSelected,
  routeSelected,
  semanticOwnerFocused,
  settingsSelected,
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
    expect(selected.activeBiomeKeyByRoute.Alternate).toBe('F');
  });

  it('seeds the first declared route and one route panel slot per declaration', () => {
    expect(reducer(undefined, { type: 'test/initialize' })).toEqual({
      activeRouteKey: 'Underworld',
      activeBiomeKeyByRoute: { Underworld: null, Surface: null },
      focusedSemanticOwner: null,
      selectedFinding: null,
      findingNavigationRevision: 0,
    });
  });

  it('selects route panels without losing another route panel selection', () => {
    const underworld = reducer(
      undefined,
      routePanelSelected({ routeKey: 'Underworld', biomeKey: 'G' }),
    );
    const surface = reducer(underworld, routePanelSelected({ routeKey: 'Surface', biomeKey: 'N' }));
    const returned = reducer(surface, routeSelected('Underworld'));

    expect(returned.activeRouteKey).toBe('Underworld');
    expect(returned.activeBiomeKeyByRoute).toEqual({ Underworld: 'G', Surface: 'N' });
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
    expect(selectedBiome.activeBiomeKeyByRoute.Surface).toBe('O');
    expect(selectedBiome.focusedSemanticOwner).toEqual(biomeSelection.origin);
    expect(selectedRoute.activeRouteKey).toBe('Underworld');
    expect(selectedRoute.activeBiomeKeyByRoute.Underworld).toBeNull();
  });

  it('issues a new navigation request when the same finding is selected again', () => {
    const selection = {
      key: 'finding-key',
      origin: createBiomeAddress('Underworld', 'F'),
    } as const;
    const selected = reducer(undefined, findingSelected(selection));
    const selectedAgain = reducer(selected, findingSelected(selection));

    expect(selectedAgain.selectedFinding).toBe(selection);
    expect(selectedAgain.findingNavigationRevision).toBe(2);
  });

  it('focuses a project-root finding without discarding the current editor location', () => {
    const biomePanel = reducer(
      undefined,
      routePanelSelected({ routeKey: 'Underworld', biomeKey: 'F' }),
    );
    const selection = { key: 'project-finding-key', origin: createProjectAddress() } as const;
    const selected = reducer(biomePanel, findingSelected(selection));

    expect(selected.activeRouteKey).toBe('Underworld');
    expect(selected.activeBiomeKeyByRoute.Underworld).toBe('F');
    expect(selected.selectedFinding).toBe(selection);
    expect(selected.focusedSemanticOwner).toEqual(selection.origin);
    expect(selected.findingNavigationRevision).toBe(1);
  });

  it('keeps semantic focus in transient session state and clears it on panel navigation', () => {
    const owner = createBiomeAddress('Underworld', 'F');
    const finding = reducer(undefined, findingSelected({ key: 'selected-finding', origin: owner }));
    const focused = reducer(finding, semanticOwnerFocused(owner));
    const navigated = reducer(
      focused,
      routePanelSelected({ routeKey: 'Underworld', biomeKey: 'F' }),
    );

    expect(focused.focusedSemanticOwner).toEqual(owner);
    expect(focused.selectedFinding).toBeNull();
    expect(navigated.focusedSemanticOwner).toBeNull();
  });

  it('rejects session addresses outside the declared route structure', () => {
    expect(() => reducer(undefined, routeSelected('Unknown'))).toThrow(
      'Editor navigation references unknown route Unknown',
    );
    expect(() =>
      reducer(undefined, routePanelSelected({ routeKey: 'Underworld', biomeKey: 'N' })),
    ).toThrow('Editor navigation references biome N outside route Underworld');
  });
});

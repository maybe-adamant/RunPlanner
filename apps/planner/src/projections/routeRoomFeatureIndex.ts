import type {
  WorkspaceRoomFeature,
  WorkspaceRoomSummary,
  WorkspaceRoute,
} from './structured-workspace';

type HermesShrineFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'hermesShrine' }>;
type StygianWellFeature = Extract<WorkspaceRoomFeature, { readonly kind: 'stygianWell' }>;

export interface RouteHermesShrineIndexRow {
  readonly biomeKey: string;
  readonly room: WorkspaceRoomSummary;
  readonly shrine: HermesShrineFeature;
}

export interface RouteStygianWellIndexRow {
  readonly biomeKey: string;
  readonly room: WorkspaceRoomSummary;
  readonly well: StygianWellFeature;
}

/** Present Shrine hosts shared by route navigation and the read-only route index. */
export function projectRouteHermesShrineIndex(
  route: WorkspaceRoute,
): readonly RouteHermesShrineIndexRow[] {
  return Object.freeze(
    route.biomes.flatMap((biome) =>
      biome.nodes.flatMap((node) => {
        if (node.kind !== 'occurrenceWorkbench') return [];
        const shrine = node.room.workbench.features.find(
          (feature): feature is HermesShrineFeature => feature.kind === 'hermesShrine',
        );
        return shrine === undefined || shrine.presence.kind === 'optionalAbsent'
          ? []
          : [Object.freeze({ biomeKey: biome.biomeKey, room: node.room, shrine })];
      }),
    ),
  );
}

/** Present Well hosts shared by route navigation and the read-only route index. */
export function projectRouteStygianWellIndex(
  route: WorkspaceRoute,
): readonly RouteStygianWellIndexRow[] {
  return Object.freeze(
    route.biomes.flatMap((biome) =>
      biome.nodes.flatMap((node) => {
        if (node.kind !== 'occurrenceWorkbench') return [];
        const well = node.room.workbench.features.find(
          (feature): feature is StygianWellFeature => feature.kind === 'stygianWell',
        );
        return well === undefined || well.presence.kind === 'optionalAbsent'
          ? []
          : [Object.freeze({ biomeKey: biome.biomeKey, room: node.room, well })];
      }),
    ),
  );
}

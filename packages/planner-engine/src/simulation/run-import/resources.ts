import { createRouteAddress, type ProjectCommand } from '../../authored-project';
import type { RunImportContext } from './import';
import { resourceFamilyOfTool } from './vocabulary';

/**
 * A gathering tool grants its element once per run, in the room whose point
 * was used (`GrantElementFromTool`, HarvestLogic.lua). That room is the
 * family's placement, authored once it is entered.
 */
export function importResourcePlacements(context: RunImportContext): void {
  for (const [roomIndex, room] of context.record.rooms.entries())
    for (const tool of room.toolElements ?? []) {
      const family = resourceFamilyOfTool(tool);
      const used = `resource:${roomIndex}:${tool}`;
      const occurrenceId = context.occurrences.occurrenceOf(roomIndex);
      if (family === undefined || context.used.has(used) || !context.entered(occurrenceId))
        continue;
      context.used.add(used);
      const project = context.assembly().project;
      const biomeKey = context.occurrences.biomeOfRoom[roomIndex]!;
      const current = project.route.resourcePlacements[family];
      if (current?.biomeKey === biomeKey && current.occurrenceId === occurrenceId) continue;
      const command: ProjectCommand = {
        kind: 'ReplaceResourcePlacement',
        route: createRouteAddress(project.route.routeKey),
        family,
        value: { biomeKey, occurrenceId },
      };
      if (!context.applyValid(command))
        context.note({
          area: 'resource',
          reason: 'refused',
          address: command.route,
          record: { roomIndex, visit: 0 },
        });
    }
}

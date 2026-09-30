import type { BiomeDeclaration } from '@run-planner/engine/catalog-schema';

/** Native BaseRoom.MinDepthBeforeIntros (RoomData.lua:648); BaseH overrides it to 0. */
const baseRoomMinDepthBeforeIntros = 3;

export const biomes = [
  { key: 'F', label: 'Erebus', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  { key: 'G', label: 'Oceanus', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  // RoomDataH.lua:334
  { key: 'H', label: 'Fields', minDepthBeforeIntros: 0 },
  { key: 'I', label: 'Tartarus', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  { key: 'N', label: 'Ephyra', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  { key: 'O', label: 'Thessaly', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  { key: 'P', label: 'Olympus', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
  { key: 'Q', label: 'Summit', minDepthBeforeIntros: baseRoomMinDepthBeforeIntros },
] as const satisfies readonly BiomeDeclaration[];

import type { FieldsSpatialDeclaration } from '@run-planner/engine/catalog-schema';

type HCombatRoom = `H_Combat${number}`;

export const hFieldsSpatial: Readonly<Record<HCombatRoom, FieldsSpatialDeclaration>> = {
  H_Combat01: {
    entryPairs: [{ startPointId: 755455, endPointId: 755458 }],
    cagePointIds: [40055, 568803, 568804, 568805, 568806],
    optionalPointIds: [685784, 685785, 685786, 685787],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 40055, spawnPointId: 572726 },
      { cagePointId: 568803, spawnPointId: 572967 },
      { cagePointId: 568804, spawnPointId: 572815 },
      { cagePointId: 568805, spawnPointId: 572761 },
      { cagePointId: 568806, spawnPointId: 685585 },
    ],
  },
  H_Combat02: {
    entryPairs: [
      { startPointId: 565481, endPointId: 565479 },
      { startPointId: 622320, endPointId: 622321 },
    ],
    cagePointIds: [621502, 622508, 622860],
    optionalPointIds: [572849, 622840, 736792],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 621502, spawnPointId: 621276 },
      { cagePointId: 622508, spawnPointId: 623047 },
      { cagePointId: 622860, spawnPointId: 623048 },
    ],
  },
  H_Combat03: {
    entryPairs: [{ startPointId: 755842, endPointId: 755845 }],
    cagePointIds: [40055, 568938, 568943],
    optionalPointIds: [686839, 686840, 686841, 686910, 686939],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 40055, spawnPointId: 568951 },
      { cagePointId: 568938, spawnPointId: 568971 },
      { cagePointId: 568943, spawnPointId: 686963 },
    ],
  },
  H_Combat04: {
    entryPairs: [
      { startPointId: 755846, endPointId: 755849 },
      { startPointId: 755851, endPointId: 755853 },
      { startPointId: 755855, endPointId: 755857 },
      { startPointId: 755859, endPointId: 755861 },
    ],
    cagePointIds: [569103, 573087, 573088, 573089],
    optionalPointIds: [572848, 572849, 572851, 572886, 572888, 572890, 633100],
    nemesisExcludedOptionalPointIds: [572886],
    cageSpawnRepresentatives: [
      { cagePointId: 569103, spawnPointId: 686366 },
      { cagePointId: 573087, spawnPointId: 686471 },
      { cagePointId: 573088, spawnPointId: 686572 },
      { cagePointId: 573089, spawnPointId: 686651 },
    ],
  },
  H_Combat05: {
    entryPairs: [
      { startPointId: 755863, endPointId: 755864 },
      { startPointId: 755866, endPointId: 755869 },
    ],
    cagePointIds: [573087, 621494, 621539, 622143, 622144],
    optionalPointIds: [572849, 621492, 622138, 622142, 623602, 623964, 623973],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 573087, spawnPointId: 702788 },
      { cagePointId: 621494, spawnPointId: 623688 },
      { cagePointId: 621539, spawnPointId: 703038 },
      { cagePointId: 622143, spawnPointId: 702790 },
      { cagePointId: 622144, spawnPointId: 702789 },
    ],
  },
  H_Combat06: {
    entryPairs: [
      { startPointId: 755870, endPointId: 755873 },
      { startPointId: 755874, endPointId: 755877 },
      { startPointId: 755878, endPointId: 755880 },
      { startPointId: 755882, endPointId: 755884 },
    ],
    cagePointIds: [573087, 621502, 622316, 622317, 622318],
    optionalPointIds: [572849, 622428, 622432, 622511],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 573087, spawnPointId: 623162 },
      { cagePointId: 621502, spawnPointId: 622291 },
      { cagePointId: 622316, spawnPointId: 623230 },
      { cagePointId: 622317, spawnPointId: 623414 },
      { cagePointId: 622318, spawnPointId: 623319 },
    ],
  },
  H_Combat07: {
    entryPairs: [
      { startPointId: 755813, endPointId: 755815 },
      { startPointId: 755817, endPointId: 755819 },
      { startPointId: 755826, endPointId: 755827 },
      { startPointId: 755829, endPointId: 755832 },
    ],
    cagePointIds: [573087, 621494, 621503],
    optionalPointIds: [621561, 621563, 621565],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 573087, spawnPointId: 621713 },
      { cagePointId: 621494, spawnPointId: 624900 },
      { cagePointId: 621503, spawnPointId: 624766 },
    ],
  },
  H_Combat08: {
    entryPairs: [
      { startPointId: 755829, endPointId: 755832 },
      { startPointId: 755833, endPointId: 755836 },
    ],
    cagePointIds: [573087, 621402, 621428],
    optionalPointIds: [572849, 621572, 621574],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 573087, spawnPointId: 686172 },
      { cagePointId: 621402, spawnPointId: 686024 },
      { cagePointId: 621428, spawnPointId: 685738 },
    ],
  },
  H_Combat09: {
    entryPairs: [{ startPointId: 755837, endPointId: 755840 }],
    cagePointIds: [621502, 715348, 715375],
    optionalPointIds: [572849, 715349],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 621502, spawnPointId: 715403 },
      { cagePointId: 715348, spawnPointId: 715404 },
      { cagePointId: 715375, spawnPointId: 715402 },
    ],
  },
  H_Combat10: {
    entryPairs: [
      { startPointId: 755837, endPointId: 755840 },
      { startPointId: 755841, endPointId: 755844 },
      { startPointId: 755846, endPointId: 755848 },
    ],
    cagePointIds: [624446, 624455, 624464, 624473, 624513],
    optionalPointIds: [624525, 624527, 624721, 625847],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 624446, spawnPointId: 625484 },
      { cagePointId: 624455, spawnPointId: 624602 },
      { cagePointId: 624464, spawnPointId: 624613 },
      { cagePointId: 624473, spawnPointId: 624606 },
      { cagePointId: 624513, spawnPointId: 624590 },
    ],
  },
  H_Combat11: {
    entryPairs: [
      { startPointId: 755850, endPointId: 755851 },
      { startPointId: 755854, endPointId: 755855 },
      { startPointId: 755857, endPointId: 755860 },
    ],
    cagePointIds: [621502, 622748, 622753, 622758, 622768],
    optionalPointIds: [625917, 627263],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 621502, spawnPointId: 626466 },
      { cagePointId: 622748, spawnPointId: 627301 },
      { cagePointId: 622753, spawnPointId: 626489 },
      { cagePointId: 622758, spawnPointId: 626473 },
      { cagePointId: 622768, spawnPointId: 626453 },
    ],
  },
  H_Combat12: {
    entryPairs: [
      { startPointId: 756049, endPointId: 756051 },
      { startPointId: 756053, endPointId: 756055 },
    ],
    cagePointIds: [627077, 627110, 627112],
    optionalPointIds: [627062, 627063, 627093],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 627077, spawnPointId: 628297 },
      { cagePointId: 627110, spawnPointId: 628270 },
      { cagePointId: 627112, spawnPointId: 628299 },
    ],
  },
  H_Combat13: {
    entryPairs: [
      { startPointId: 760458, endPointId: 760464 },
      { startPointId: 760461, endPointId: 760460 },
    ],
    cagePointIds: [621502, 715356],
    optionalPointIds: [572849, 736822],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [{ cagePointId: 715356, spawnPointId: 715598 }],
  },
  H_Combat14: {
    entryPairs: [
      { startPointId: 760468, endPointId: 760466 },
      { startPointId: 760471, endPointId: 760466 },
    ],
    cagePointIds: [621502, 736882],
    optionalPointIds: [572849, 737000],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 621502, spawnPointId: 621276 },
      { cagePointId: 736882, spawnPointId: 737002 },
    ],
  },
  H_Combat15: {
    entryPairs: [
      { startPointId: 760468, endPointId: 760466 },
      { startPointId: 760471, endPointId: 760470 },
    ],
    cagePointIds: [621502, 737521, 737530],
    optionalPointIds: [572849, 737955],
    nemesisExcludedOptionalPointIds: [],
    cageSpawnRepresentatives: [
      { cagePointId: 621502, spawnPointId: 737970 },
      { cagePointId: 737521, spawnPointId: 737969 },
      { cagePointId: 737530, spawnPointId: 621276 },
    ],
  },
};

import type { FieldsSpatialDeclaration } from '@run-planner/engine/catalog-schema';

type HCombatRoom = `H_Combat${number}`;

export const hFieldsSpatial: Readonly<Record<HCombatRoom, FieldsSpatialDeclaration>> = {
  H_Combat01: {
    entryPairs: [{ startPointId: 755455, endPointId: 755458 }],
    cagePointIds: [40055, 568803, 568804, 568805, 568806],
    optionalPointIds: [685784, 685785, 685786, 685787],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat02: {
    entryPairs: [
      { startPointId: 565481, endPointId: 565479 },
      { startPointId: 622320, endPointId: 622321 },
    ],
    cagePointIds: [621502, 622508, 622860],
    optionalPointIds: [572849, 622840, 736792],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat03: {
    entryPairs: [{ startPointId: 755842, endPointId: 755845 }],
    cagePointIds: [40055, 568938, 568943],
    optionalPointIds: [686839, 686840, 686841, 686910, 686939],
    nemesisExcludedOptionalPointIds: [],
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
  },
  H_Combat05: {
    entryPairs: [
      { startPointId: 755863, endPointId: 755864 },
      { startPointId: 755866, endPointId: 755869 },
    ],
    cagePointIds: [573087, 621494, 621539, 622143, 622144],
    optionalPointIds: [572849, 621492, 622138, 622142, 623602, 623964, 623973],
    nemesisExcludedOptionalPointIds: [],
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
  },
  H_Combat08: {
    entryPairs: [
      { startPointId: 755829, endPointId: 755832 },
      { startPointId: 755833, endPointId: 755836 },
    ],
    cagePointIds: [573087, 621402, 621428],
    optionalPointIds: [572849, 621572, 621574],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat09: {
    entryPairs: [{ startPointId: 755837, endPointId: 755840 }],
    cagePointIds: [621502, 715348, 715375],
    optionalPointIds: [572849, 715349],
    nemesisExcludedOptionalPointIds: [],
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
  },
  H_Combat12: {
    entryPairs: [
      { startPointId: 756049, endPointId: 756051 },
      { startPointId: 756053, endPointId: 756055 },
    ],
    cagePointIds: [627077, 627110, 627112],
    optionalPointIds: [627062, 627063, 627093],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat13: {
    entryPairs: [
      { startPointId: 760458, endPointId: 760464 },
      { startPointId: 760461, endPointId: 760460 },
    ],
    cagePointIds: [621502, 715356],
    optionalPointIds: [572849, 736822],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat14: {
    entryPairs: [
      { startPointId: 760468, endPointId: 760466 },
      { startPointId: 760471, endPointId: 760466 },
    ],
    cagePointIds: [621502, 736882],
    optionalPointIds: [572849, 737000],
    nemesisExcludedOptionalPointIds: [],
  },
  H_Combat15: {
    entryPairs: [
      { startPointId: 760468, endPointId: 760466 },
      { startPointId: 760471, endPointId: 760470 },
    ],
    cagePointIds: [621502, 737521, 737530],
    optionalPointIds: [572849, 737955],
    nemesisExcludedOptionalPointIds: [],
  },
};

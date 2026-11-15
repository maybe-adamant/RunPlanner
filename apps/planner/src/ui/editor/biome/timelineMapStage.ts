import { createContext } from 'react';

/**
 * Where a Timeline row stands against its room's opening (the doors, or a Ship tab's wheel):
 * before it, from it on, or leaving. Rows outside a Timeline stand nowhere.
 */
export type TimelineMapStage = 'closed' | 'open' | 'left';

export const TimelineMapStageContext = createContext<TimelineMapStage | undefined>(undefined);

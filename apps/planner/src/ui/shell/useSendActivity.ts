import { useEffect, useState } from 'react';

import { GAME_SEND_IDLE, type GameSendActivity } from '@planner/projections/gamePanel';

/** How long a send's result stays on the button. */
const GAME_SEND_RESULT_MS = 3000;

/** A send's result stays on the button for a fixed time, then the button returns to its state. */
export function useSendActivity() {
  const [activity, setActivity] = useState<GameSendActivity>(GAME_SEND_IDLE);
  useEffect(() => {
    if (activity.kind !== 'sent' && activity.kind !== 'failed') return;
    const timer = window.setTimeout(() => setActivity(GAME_SEND_IDLE), GAME_SEND_RESULT_MS);
    return () => window.clearTimeout(timer);
  }, [activity]);
  return [activity, setActivity] as const;
}

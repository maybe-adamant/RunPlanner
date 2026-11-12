import type { RoomActionContact } from '../../simulation/room-actions';
import type { ExecutionLifecycleWindow } from '../model';

/** The execution protocol's contact for a row, from its classified contact. */
export function wireWindow(contact: RoomActionContact): ExecutionLifecycleWindow {
  switch (contact.kind) {
    case 'afterDoorsOpen':
      return Object.freeze({ kind: 'postOutgoing' });
    case 'beforeCombat':
      return contact.wheelKey === undefined
        ? Object.freeze({ kind: 'standard', phase: 'beforeCombat' })
        : Object.freeze({ kind: 'shipPreCombat', wheelKey: contact.wheelKey });
    case 'beforeWheelPhase':
    case 'beforeWheelChoice':
      return Object.freeze({ kind: 'shipPreCombat', wheelKey: contact.wheelKey });
    case 'afterWheelPhase':
      return Object.freeze({ kind: 'shipPostCombat', wheelKey: contact.wheelKey });
    case 'afterEncounterEnd':
    case 'fields':
      // A Fields cage's freed reward and what its fight spawns share the cage's encounter end.
      return contact.endedPhaseKey === undefined
        ? Object.freeze({ kind: 'standard', phase: 'afterCombat' })
        : Object.freeze({ kind: 'encounterEnd', phaseKey: contact.endedPhaseKey });
    case 'afterCombat':
      return Object.freeze({ kind: 'standard', phase: 'afterCombat' });
  }
}

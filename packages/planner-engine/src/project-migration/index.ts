// Pure document transformations a project schema migration needs from engine facts.
// Only the migration runs them; nothing in evaluation, authoring or publication does.
export { fillNemesisBetOutcomeWins } from './nemesis-bet-outcome-wins';
export { moveLockedDoorFightOntoDoor } from './locked-door-fight';
export { exchangeBlockedWheelOffers, type WheelSideOrderBlock } from './wheel-side-order';
export { moveWellPoolRollsOntoObjects } from './well-pool-rolls';
export { settleProjectUpgrade } from '../simulation/edit-settlement';

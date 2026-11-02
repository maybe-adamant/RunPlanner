// Pure document transformations a project schema migration needs from engine facts.
// Only the migration runs them; nothing in evaluation, authoring or publication does.
export { fillNemesisBetOutcomeWins } from './nemesis-bet-outcome-wins';
export { exchangeBlockedWheelOffers, type WheelSideOrderBlock } from './wheel-side-order';

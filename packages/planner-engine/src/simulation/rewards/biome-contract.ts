export class BiomeRewardSimulationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'BiomeRewardSimulationContractError';
  }
}

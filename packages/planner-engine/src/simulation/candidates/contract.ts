export class CandidateEvaluationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'CandidateEvaluationContractError';
  }
}

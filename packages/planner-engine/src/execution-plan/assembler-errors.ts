import type { ExecutionCompilerError as ExecutionCompilerErrorContract } from './model';

export class ExecutionCompilerError extends Error {
  readonly code: NonNullable<ExecutionCompilerErrorContract['code']>;

  constructor(code: NonNullable<ExecutionCompilerErrorContract['code']>, message: string) {
    super(message);
    this.name = 'ExecutionCompilerError';
    this.code = code;
  }
}

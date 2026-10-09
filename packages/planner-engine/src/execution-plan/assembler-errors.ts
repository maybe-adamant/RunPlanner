import type { ExecutionCompilerError as ExecutionCompilerErrorContract } from './model';

export class ExecutionCompilerError extends Error {
  readonly code: NonNullable<ExecutionCompilerErrorContract['code']>;
  declare readonly startPointReason?: ExecutionCompilerErrorContract['startPointReason'];

  constructor(
    code: NonNullable<ExecutionCompilerErrorContract['code']>,
    message: string,
    startPointReason?: ExecutionCompilerErrorContract['startPointReason'],
  ) {
    super(message);
    this.name = 'ExecutionCompilerError';
    this.code = code;
    if (startPointReason !== undefined) this.startPointReason = startPointReason;
  }
}

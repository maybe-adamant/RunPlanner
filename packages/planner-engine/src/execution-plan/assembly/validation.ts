import { ExecutionCompilerError as CompilerError } from '../assembler-errors';
import { validateExecutionGraph } from '../graph-validation';
import type { ExecutionSemanticProduct } from '../model';

export function validateExecutionProduct(product: ExecutionSemanticProduct): void {
  validateExecutionGraph(product, (detail) => {
    throw new CompilerError('executionCoverageMissing', detail);
  });
}

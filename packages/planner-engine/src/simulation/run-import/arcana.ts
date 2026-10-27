import type { ProjectCommand } from '../../authored-project';
import type { SemanticFinding } from '../model';
import type { RunImportContext } from './import';

/**
 * Answers Judgment's and the Crystal Figurine's drawn Arcana from the boss
 * room's granted cards. Both draw in one call, Judgment first, and each card's
 * trait joins `Hero.Traits` as drawn (`AddRandomMetaUpgrades`), so Judgment's
 * cards lead the granted order and the Figurine's close it.
 */
export function answerArcanaGrant(context: RunImportContext, reason: SemanticFinding): boolean {
  const origin = reason.origin;
  if (!(
    (reason.code === 'judgmentOutcomeMissing' && origin.kind === 'judgmentArcana') ||
    (reason.code === 'figurineOutcomeMissing' && origin.kind === 'figurineArcana')
  ))
    return false;
  const roomIndex = context.occurrences.visitsOf(origin.occurrenceId)[0];
  const granted =
    roomIndex === undefined ? undefined : context.record.rooms[roomIndex]!.grantedArcana;
  if (granted === undefined) return false;
  const assess = (arcanaKeys: readonly string[]) => {
    const evaluation =
      origin.kind === 'figurineArcana'
        ? context.candidates().evaluate({ kind: 'figurineArcana', figurine: origin, arcanaKeys })
        : context.candidates().evaluate({ kind: 'judgmentArcana', judgment: origin, arcanaKeys });
    return evaluation.kind === 'figurineArcana' || evaluation.kind === 'judgmentArcana'
      ? evaluation.result
      : undefined;
  };
  const required = assess([])?.requiredCount;
  if (required === undefined || required > granted.length) return false;
  const arcanaKeys =
    origin.kind === 'judgmentArcana' ? granted.slice(0, required) : granted.slice(-required);
  const command: ProjectCommand =
    origin.kind === 'figurineArcana'
      ? { kind: 'ReplaceFigurineArcana', figurine: origin, arcanaKeys }
      : { kind: 'ReplaceJudgmentArcana', judgment: origin, arcanaKeys };
  const result = assess(arcanaKeys);
  if (result?.selectedPossible === true && context.apply(command)) return true;
  context.refuse();
  return false;
}

import type { Catalog } from '../../catalog-schema';
import type { AuthoredNemesisRandomEventOutcome } from '../model';
import {
  expectExactKeys,
  expectNonBlankString,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';

export function decodeNemesisRandomEventOutcome(
  value: unknown,
  catalog: Catalog,
  path: string,
): AuthoredNemesisRandomEventOutcome {
  const record = expectRecord(value, path);
  const kind = expectString(record.kind, `${path}.kind`);
  switch (kind) {
    case 'freeItem':
      expectExactKeys(record, ['kind'], path);
      return Object.freeze({ kind });
    case 'goldTrade':
      expectExactKeys(record, ['kind', 'response'], path);
      return Object.freeze({
        kind,
        response: decodeNemesisResponse(record.response, `${path}.response`),
      });
    case 'damageTrade':
      expectExactKeys(record, ['kind', 'response'], path);
      return Object.freeze({
        kind,
        response: decodeNemesisResponse(record.response, `${path}.response`),
      });
    case 'traitTrade': {
      expectExactKeys(record, ['kind', 'traitKey', 'response'], path);
      const traitKey = expectNonBlankString(record.traitKey, `${path}.traitKey`);
      if (catalog.traits.byKey[traitKey] === undefined)
        failProjectDocument(`${path}.traitKey`, 'unknown trait');
      return Object.freeze({
        kind,
        traitKey,
        response: decodeNemesisResponse(record.response, `${path}.response`),
      });
    }
    case 'damageContest': {
      expectExactKeys(record, ['kind', 'result'], path);
      const result = expectString(record.result, `${path}.result`);
      if (result !== 'success' && result !== 'failure')
        failProjectDocument(`${path}.result`, 'must be success or failure');
      return Object.freeze({ kind, result });
    }
    default:
      failProjectDocument(`${path}.kind`, 'must be a closed Nemesis event outcome');
  }
}

function decodeNemesisResponse(value: unknown, path: string): 'accept' | 'decline' {
  const response = expectString(value, path);
  if (response !== 'accept' && response !== 'decline')
    failProjectDocument(path, 'must be accept or decline');
  return response;
}

/**
 * Replacement preserves only an exact stable slot whose retained concrete
 * definition is still legal in the replacement slot's declared set. It never
 * consults current simulation eligibility or repairs a context-invalid choice.
 */

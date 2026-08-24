import { createOccurrenceId } from './addresses';

export function completionOccurrenceId(biomeKey: string, role: 'boss' | 'postboss') {
  return createOccurrenceId(`completion:${biomeKey}:${role}`);
}

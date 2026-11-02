import type {
  GeneratedEncounterAssessment,
  InfiniteRosterAssessment,
} from '@run-planner/engine/simulation';

export type CompositionIssue = GeneratedEncounterAssessment['issues'][number];
export type RosterIssue = InfiniteRosterAssessment['issues'][number];

/** One issue's wording: `message` for its dialog row, `titles` for a finding, longest first. */
export interface EncounterIssueCopy {
  readonly message: string;
  /** Candidate finding titles, most specific first; the last never names an enemy. */
  readonly titles: readonly string[];
  /** A rule or alternative repair the title cannot carry. */
  readonly description?: string;
}

/** Player-facing names an issue's wording interpolates. */
export interface EncounterIssueNames {
  readonly enemy: (enemyKey: string) => string | undefined;
  readonly introduction: (encounterKey: string) => string | undefined;
}

export function generatedEnemyLabel(label: string): string {
  return label.endsWith(' (Elite)') ? `Elite ${label.slice(0, -8)}` : label;
}

function plural(count: number, singular: string) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function range(min: number, max: number) {
  return min === max ? String(min) : `${min}–${max}`;
}

function capitalized(text: string) {
  return `${text[0]!.toUpperCase()}${text.slice(1)}`;
}

/** Why an unintroduced enemy is excluded, naming its repair. */
export function introductionExclusionMessage(
  enemyLabel: string,
  introductionLabel: string,
  admitted: boolean,
): string {
  return admitted
    ? `${enemyLabel} is not introduced yet: select ${introductionLabel} for this encounter, or remove ${enemyLabel}.`
    : `${enemyLabel} is not introduced yet and cannot appear here until ${introductionLabel} is completed; remove it.`;
}

/** Titles naming the enemy first, when it has a name, then the nameless ones. */
function namedTitles(
  name: string | undefined,
  named: readonly ((enemy: string) => string)[],
  nameless: readonly string[],
): readonly string[] {
  return [...(name === undefined ? [] : named.map((wording) => wording(name))), ...nameless];
}

/**
 * A generated composition issue's wording. `seeds` are its wave's opening
 * spawns, which name an exact type count's members when the dialog has them.
 */
export function compositionIssueCopy(
  issue: CompositionIssue,
  names: EncounterIssueNames,
  seeds: GeneratedEncounterAssessment['waves'][number]['seeds'] = [],
): EncounterIssueCopy {
  const waveIndex = 'waveIndex' in issue ? issue.waveIndex : undefined;
  const inWave = (text: string) =>
    waveIndex === undefined ? capitalized(text) : `Wave ${waveIndex}: ${text}`;
  const enemy = 'key' in issue ? names.enemy(issue.key) : undefined;
  const enemyLabel = enemy ?? 'Unavailable enemy';
  switch (issue.reason) {
    case 'required':
      switch (issue.field) {
        case 'waveCount':
          return { message: 'Choose the number of waves.', titles: ['Choose the number of waves'] };
        case 'baseRoll':
          return { message: 'Choose an encounter budget.', titles: ['Choose an encounter budget'] };
        case 'highlight':
          return { message: 'Choose the shared enemy.', titles: ['Choose the shared enemy'] };
        case 'wave':
          return { message: 'Choose its enemies.', titles: [inWave('choose its enemies')] };
        default:
          return {
            message: 'Set each editable enemy budget.',
            titles: ['Set each editable enemy budget'],
          };
      }
    case 'baseRoll':
      return {
        message: `Stored budget ${issue.actual} is unavailable. Choose a supported budget.`,
        titles: [`Encounter budget ${issue.actual} is unavailable`],
      };
    case 'waveCount':
      return {
        message: `Wave count ${issue.actual} is outside ${issue.allowed.min}–${issue.allowed.max}.`,
        titles: [`Wave count must be ${range(issue.allowed.min, issue.allowed.max)}`],
      };
    case 'highlight':
      return {
        message: `Shared enemy ${enemyLabel} is not available in this encounter context.`,
        titles: namedTitles(
          enemy,
          [
            (name) => `Shared enemy ${name} isn't available`,
            (name) => `${name} can't be the shared enemy`,
          ],
          ["Shared enemy isn't available here"],
        ),
      };
    case 'enemyUnavailable':
      return {
        message: `Enemy ${issue.position} (${enemyLabel}) is not available.`,
        titles: namedTitles(
          enemy,
          [(name) => inWave(`${name} isn't available`)],
          [inWave(`enemy ${issue.position} isn't available`)],
        ),
      };
    case 'introductionRequired': {
      const introduction = names.introduction(issue.introductionEncounterKey);
      return {
        message: introductionExclusionMessage(
          enemyLabel,
          introduction ?? issue.introductionEncounterKey,
          issue.admitted,
        ),
        titles: namedTitles(
          enemy,
          [(name) => inWave(`${name} isn't introduced yet`), (name) => `${name} isn't introduced`],
          [inWave("an enemy isn't introduced yet")],
        ),
        ...(introduction === undefined
          ? {}
          : {
              description: issue.admitted
                ? `Select ${introduction} for this encounter, or remove the enemy.`
                : `It can't appear until ${introduction} is completed.`,
            }),
      };
    }
    case 'typeCount': {
      const excess = Math.max(0, issue.actual - issue.allowed.max);
      const missing = Math.max(0, issue.allowed.min - issue.actual);
      if (missing > 0)
        return {
          message: `Needs at least ${plural(issue.allowed.min, 'total type')}; add ${plural(missing, 'type')}.`,
          titles: [
            inWave(`needs ${plural(issue.allowed.min, 'enemy type')}; add ${missing}`),
            inWave(`add ${plural(missing, 'enemy type')}`),
          ],
        };
      const label = (key: string) => names.enemy(key) ?? 'Unavailable enemy';
      const message =
        issue.allowed.min === issue.allowed.max && seeds.length === issue.allowed.max
          ? `Allows only ${seeds.map((seed) => (seed.kind === 'highlight' ? 'the shared enemy' : label(seed.key))).join(' and ')}; remove ${plural(excess, 'additional type')}.`
          : `Allows ${plural(issue.allowed.max, 'total type')}${
              seeds.some((seed) => seed.kind === 'highlight') ? ' including the shared enemy' : ''
            }; remove ${plural(excess, 'type')}.`;
      return {
        message,
        titles: [
          inWave(`allows ${plural(issue.allowed.max, 'enemy type')}; remove ${excess}`),
          inWave(`remove ${plural(excess, 'enemy type')}`),
        ],
      };
    }
    case 'placeholderCount':
      return {
        message: `Needs ${issue.allowed} generated companion; found ${issue.actual}.`,
        titles: [inWave(`needs ${plural(issue.allowed, 'generated companion')}`)],
      };
    case 'allocationMembers':
      return {
        message:
          'Budgets include an enemy that no longer has an editable budget. Edit the affected wave.',
        titles: [inWave('edit its enemy budgets')],
      };
    case 'fangs':
      switch (issue.issue) {
        case 'typeUnavailable':
          return {
            message:
              'The stored Fangs elite is not in the active encounter composition. Choose an available elite.',
            titles: ["Fangs elite isn't in this encounter"],
          };
        case 'perkUnavailable':
          return {
            message:
              'The stored Fangs perks are no longer a legal native pick order. Repair the selection.',
            titles: ["Fangs perks can't be picked in this order"],
          };
        default:
          return {
            message: 'Choose the next available Fangs perk.',
            titles: ['Choose the next Fangs perk'],
          };
      }
    case 'menace':
      switch (issue.issue) {
        case 'targetRequired':
          return {
            message: `Choose a Menace replacement before converting ${enemyLabel}.`,
            titles: namedTitles(
              enemy,
              [(name) => inWave(`choose a Menace replacement for ${name}`)],
              [inWave('choose a Menace replacement')],
            ),
          };
        case 'targetUnavailable':
          return {
            message: `The stored Menace replacement for ${enemyLabel} is unavailable. Choose another replacement.`,
            titles: namedTitles(
              enemy,
              [(name) => inWave(`${name} Menace replacement unavailable`)],
              [inWave('Menace replacement unavailable')],
            ),
          };
        default:
          return {
            message: `Converted ${enemyLabel} requests exceed its current count. Reduce Menace Count.`,
            titles: namedTitles(
              enemy,
              [(name) => inWave(`reduce Menace Count for ${name}`)],
              [inWave('reduce Menace Count')],
            ),
          };
      }
  }
}

/** An infinite roster issue's finding titles, most specific first. */
export function rosterIssueTitles(
  issue: RosterIssue,
  names: EncounterIssueNames,
): readonly string[] {
  switch (issue.reason) {
    case 'enemyUnavailable':
      return namedTitles(
        names.enemy(issue.key),
        [(name) => `${name} can't be drawn here`],
        [`Roster enemy ${issue.position} can't be drawn here`],
      );
    case 'typeCount': {
      const excess = Math.max(0, issue.actual - issue.allowed.max);
      const missing = Math.max(0, issue.allowed.min - issue.actual);
      return missing > 0
        ? [
            `Roster needs ${plural(issue.allowed.min, 'enemy type')}; add ${missing}`,
            `Add ${plural(missing, 'roster enemy type')}`,
          ]
        : [
            `Roster allows ${plural(issue.allowed.max, 'enemy type')}; remove ${excess}`,
            `Remove ${plural(excess, 'roster enemy type')}`,
          ];
    }
  }
}

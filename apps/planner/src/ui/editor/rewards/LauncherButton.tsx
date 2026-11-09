import type { WorkspaceLauncherPresentation } from '@planner/projections/structured-workspace';
import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { traitIcon } from '@planner/ui/artwork/traitArtwork';
import { Fragment } from 'react';

import { ActionIcon } from '@planner/ui/controls/ActionIcon';
import { hintProps } from '@planner/ui/controls/hint';
import { showTruncatedTitle } from '@planner/ui/controls/truncatedTitle';
import { candidateWaitingHint } from '@planner/ui/feedback/candidatePresentation';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { TimelineChip, TimelineChipFace } from './TimelineChip';
import { timelineChipProps } from './timelineChipProps';

/**
 * One neutral dialog launcher: a one-line label, its full summary on hover and as description.
 * As a `slot` it is an empty chip awaiting its first value; as `edit`, a small pencil
 * beside chips that already show the value; as `chip`, the value's one chip.
 */
export function LauncherButton({
  contextReached,
  launcher,
  onClick,
  presentation = 'label',
  target,
}: {
  readonly contextReached: boolean;
  readonly launcher: WorkspaceLauncherPresentation;
  readonly onClick: () => void;
  readonly presentation?: 'label' | 'slot' | 'edit' | 'chip';
  /** A navigation target, or a mark within an anchor that navigation focuses. */
  readonly target: FindingMarkProps & { readonly id: string };
}) {
  const findings = target['aria-description'];
  const compact = presentation !== 'label';
  const chip = presentation === 'chip' ? launcher.chips?.[0] : undefined;
  const chipProps = chip === undefined ? undefined : timelineChipProps(chip);
  return (
    <button
      {...target}
      {...(contextReached
        ? hintProps(
            chipProps?.['data-hint'] ?? launcher.detail,
            findings,
            chipProps === undefined ? undefined : launcher.label,
          )
        : hintProps(
            candidateWaitingHint,
            [launcher.detail, findings].filter((part) => part !== undefined).join(' ') || undefined,
          ))}
      {...(launcher.value === undefined && !compact ? {} : { 'aria-label': launcher.label })}
      {...(chipProps?.['data-rarity'] === undefined
        ? {}
        : { 'data-rarity': chipProps['data-rarity'] })}
      {...(chipProps === undefined ? {} : { 'data-chip-state': chipProps['data-chip-state'] })}
      className={
        presentation === 'chip'
          ? 'dialog-launcher trait-offer-launcher timeline-chip'
          : presentation === 'slot'
            ? 'dialog-launcher trait-offer-launcher timeline-chip timeline-chip-slot'
            : presentation === 'edit'
              ? 'dialog-launcher trait-offer-launcher timeline-chip-edit'
              : 'dialog-launcher trait-offer-launcher quiet-action action-compact'
      }
      disabled={!contextReached || undefined}
      onClick={onClick}
      type="button"
    >
      {presentation === 'slot' ? (
        launcher.slotBadge === undefined ? null : (
          <span aria-hidden="true" className="corner-badge timeline-chip-badge">
            {launcher.slotBadge}
          </span>
        )
      ) : chip !== undefined ? (
        <TimelineChipFace chip={chip} />
      ) : presentation === 'edit' ? (
        <ActionIcon name="edit" />
      ) : (
        <>
          {launcher.traitKey === undefined ? null : (
            <ArtworkIcon className="artwork-label-icon" source={traitIcon(launcher.traitKey)} />
          )}
          <span className="dialog-launcher-text" onMouseEnter={showTruncatedTitle}>
            {launcher.value ?? launcher.label}
          </span>
        </>
      )}
    </button>
  );
}

/** A thin rule parting a row's source from the option chips it offers. */
export function SourceOptionsRule() {
  return <span aria-hidden="true" className="timeline-source-rule" />;
}

/**
 * A dialog launcher whose value is shown as chips: an empty slot until chosen,
 * or while it waits on an earlier choice. A lone chip opens the dialog itself
 * where `chipOpens`; otherwise the chips sit before a pencil, a struck removal
 * leading by an arrow to what follows it.
 */
export function ChipLauncher({
  chipOpens = false,
  contextReached,
  launcher,
  onClick,
  target,
}: {
  readonly chipOpens?: boolean;
  readonly contextReached: boolean;
  readonly launcher: WorkspaceLauncherPresentation;
  readonly onClick: () => void;
  readonly target: FindingMarkProps & { readonly id: string };
}) {
  const chips = launcher.chips;
  const button = (presentation: 'label' | 'slot' | 'edit' | 'chip') => (
    <LauncherButton
      contextReached={contextReached}
      launcher={launcher}
      onClick={onClick}
      presentation={presentation}
      target={target}
    />
  );
  if (!contextReached || chips?.length === 0) return button('slot');
  if (chips === undefined) return button('label');
  if (chipOpens && chips.length === 1)
    return (
      <span className="timeline-chip-group">
        <SourceOptionsRule />
        {button('chip')}
      </span>
    );
  const removed = chips.filter((chip) => chip.state === 'removed').length;
  return (
    <span className="timeline-chip-group">
      <SourceOptionsRule />
      {chips.map((chip, index) => (
        <Fragment key={`${chip.state}-${chip.key}-${index}`}>
          {removed > 0 && index === removed ? (
            <span aria-hidden="true" className="row-reward-arrow">
              →
            </span>
          ) : null}
          <TimelineChip chip={chip} />
        </Fragment>
      ))}
      {button('edit')}
    </span>
  );
}

export interface HintProps {
  readonly 'data-hint'?: string;
  readonly 'aria-description'?: string;
}

/**
 * Hover and focus hint of a control. The hint text also leads its accessible
 * description, followed by any description the control already carries; text
 * the description or accessible name already states is not repeated.
 */
export function hintProps(
  hint: string | undefined,
  description?: string,
  accessibleName?: string,
): HintProps {
  const present = (text: string | undefined): text is string => text !== undefined && text !== '';
  const spoken =
    present(hint) &&
    !(accessibleName?.includes(hint) ?? false) &&
    !(description?.includes(hint) ?? false)
      ? hint
      : undefined;
  const accessible = [spoken, description].filter(present).join(' ');
  return {
    ...(present(hint) ? { 'data-hint': hint } : {}),
    ...(accessible === '' ? {} : { 'aria-description': accessible }),
  };
}

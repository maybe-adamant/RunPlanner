export interface HintProps {
  readonly 'data-hint'?: string;
  readonly 'aria-description'?: string;
}

/**
 * Hover and focus hint of a control. The hint text also leads its accessible
 * description, followed by any description the control already carries.
 */
export function hintProps(hint: string | undefined, description?: string): HintProps {
  const accessible = [hint, description === hint ? undefined : description]
    .filter((part) => part !== undefined && part !== '')
    .join(' ');
  return {
    ...(hint === undefined || hint === '' ? {} : { 'data-hint': hint }),
    ...(accessible === '' ? {} : { 'aria-description': accessible }),
  };
}

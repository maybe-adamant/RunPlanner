/** A bounded numeric slider; `display` presents a value other than the stored one. */
export function ValueSlider({
  ariaLabel,
  display = String,
  maximum,
  minimum,
  onChange,
  step,
  value,
}: {
  readonly ariaLabel: string;
  readonly display?: (value: number) => string;
  readonly maximum: number;
  readonly minimum: number;
  readonly onChange: (value: number) => void;
  readonly step: number;
  readonly value: number;
}) {
  const shown = display(value);
  return (
    <span className="value-slider">
      <input
        aria-label={ariaLabel}
        {...(shown === String(value) ? {} : { 'aria-valuetext': shown })}
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
      <output aria-label={`${ariaLabel} value`}>{shown}</output>
    </span>
  );
}

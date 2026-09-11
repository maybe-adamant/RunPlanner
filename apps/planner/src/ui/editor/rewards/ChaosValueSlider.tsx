export function ChaosValueSlider({
  ariaLabel,
  maximum,
  minimum,
  onChange,
  step,
  value,
}: {
  readonly ariaLabel: string;
  readonly maximum: number;
  readonly minimum: number;
  readonly onChange: (value: number) => void;
  readonly step: number;
  readonly value: number;
}) {
  return (
    <span className="chaos-value-slider">
      <input
        aria-label={ariaLabel}
        max={maximum}
        min={minimum}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        step={step}
        type="range"
        value={value}
      />
      <output aria-label={`${ariaLabel} value`}>{value}</output>
    </span>
  );
}

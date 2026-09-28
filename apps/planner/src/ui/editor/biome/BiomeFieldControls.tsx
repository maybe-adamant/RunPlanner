import type { WorkspaceBiomeField } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { useFindingTarget } from '@planner/ui/feedback/useFindingTarget';

function BiomeFieldControl({ field }: { readonly field: WorkspaceBiomeField }) {
  const findingTarget = useFindingTarget();
  const dispatch = useAppDispatch();
  const id = `biome-field-${field.marker.focusKey}`;
  const replace = (value: boolean | number | string): void => {
    dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceBiomeField',
        field: field.address,
        value,
      }),
    );
  };

  switch (field.kind) {
    case 'boolean':
      return (
        <label className="field-control biome-field" htmlFor={id}>
          <span>{field.label}</span>
          <select
            {...findingTarget(field.marker.address, id)}
            id={id}
            onChange={(event) => replace(event.target.value === 'true')}
            value={field.value === null ? '' : String(field.value)}
          >
            <option disabled value="">
              Select value
            </option>
            {field.values.map((value) => (
              <option key={String(value)} value={String(value)}>
                {value ? 'Enabled' : 'Disabled'}
              </option>
            ))}
          </select>
        </label>
      );
    case 'boundedInteger':
      return (
        <div className="field-control biome-field biome-field-radio-row">
          <span id={`${id}-label`}>{field.label}</span>
          <div
            {...findingTarget(field.marker.address, id)}
            id={id}
            aria-labelledby={`${id}-label`}
            className="biome-field-radios"
            role="radiogroup"
            aria-required="true"
            tabIndex={-1}
          >
            {field.values.map((value) => (
              <label key={value}>
                <input
                  type="radio"
                  name={id}
                  checked={field.value === value}
                  onChange={() => replace(value)}
                />
                {value}
              </label>
            ))}
          </div>
        </div>
      );
    case 'enum':
      return (
        <label className="field-control biome-field" htmlFor={id}>
          <span>{field.label}</span>
          <select
            {...findingTarget(field.marker.address, id)}
            id={id}
            onChange={(event) => replace(event.target.value)}
            value={field.value ?? ''}
          >
            <option disabled value="">
              Select value
            </option>
            {field.values.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      );
  }
}

/** Renders normalized biome-owned authoring fields without reading a layout. */
export function BiomeFieldControls({
  fields,
}: {
  readonly fields: readonly WorkspaceBiomeField[];
}) {
  if (fields.length === 0) return null;
  return (
    <section aria-label="Biome settings" className="biome-field-controls">
      {fields.map((field) => (
        <BiomeFieldControl field={field} key={field.key} />
      ))}
    </section>
  );
}

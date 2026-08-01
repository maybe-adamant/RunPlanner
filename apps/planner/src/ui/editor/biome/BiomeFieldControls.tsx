import type { WorkspaceBiomeField } from '@planner/projections/structured-workspace';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import { SemanticOwnerMarker } from '@planner/ui/feedback/EvaluationFeedback';

function BiomeFieldControl({ field }: { readonly field: WorkspaceBiomeField }) {
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
          <span className="field-label-with-marker">
            {field.label}
            <SemanticOwnerMarker address={field.marker.address} />
          </span>
          <select
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
        <label className="field-control biome-field" htmlFor={id}>
          <span className="field-label-with-marker">
            {field.label}
            <SemanticOwnerMarker address={field.marker.address} />
          </span>
          <select
            id={id}
            onChange={(event) => replace(Number(event.target.value))}
            value={field.value === null ? '' : String(field.value)}
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
    case 'enum':
      return (
        <label className="field-control biome-field" htmlFor={id}>
          <span className="field-label-with-marker">
            {field.label}
            <SemanticOwnerMarker address={field.marker.address} />
          </span>
          <select
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

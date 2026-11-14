/**
 * Preview of how a Doors open moment edits its doors, picked by VITE_DOORS_VARIANT in the
 * gallery: the inline table (the default), a popover per chip, or one popover for the moment.
 */
export type DoorsMomentVariant = 'table' | 'chips' | 'moment';

const requested: unknown = import.meta.env['VITE_DOORS_VARIANT'];

export const doorsMomentVariant: DoorsMomentVariant =
  requested === 'chips' || requested === 'moment' ? requested : 'table';

/** The doors' editor shows inline under the Doors open row only in the table variant. */
export const doorsDetailInline = doorsMomentVariant === 'table';

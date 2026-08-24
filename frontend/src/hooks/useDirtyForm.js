import { hasFormChanges } from '../utils/formChanges';

// Tracks whether a form has pending changes compared to an initial snapshot.
// The snapshot is owned by the caller (captured when the modal opens and
// cleared on close/success), which keeps domain hooks in charge of their state.
export const useDirtyForm = (currentValues, initialValues) => ({
  isDirty: hasFormChanges(currentValues, initialValues),
});

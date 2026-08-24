// Structural comparison used to detect pending (unsaved) form changes.
// Returns true when `current` differs from `initial`; returns false when there
// is no `initial` snapshot yet (e.g. the modal has never been opened) or when
// both values are structurally equal. Arrays and objects are compared deeply,
// so adding/removing items or editing a nested field counts as a change.
export const hasFormChanges = (current, initial) => {
  if (initial === null || initial === undefined) return false;
  if (current === initial) return false;
  if (current === null || current === undefined) return true;

  const currentType = typeof current;
  if (currentType !== 'object') return current !== initial;

  if (Array.isArray(current) || Array.isArray(initial)) {
    if (!Array.isArray(current) || !Array.isArray(initial)) return true;
    if (current.length !== initial.length) return true;
    return current.some((item, index) => hasFormChanges(item, initial[index]));
  }

  const currentKeys = Object.keys(current);
  const initialKeys = Object.keys(initial);
  if (currentKeys.length !== initialKeys.length) return true;
  return currentKeys.some((key) => hasFormChanges(current[key], initial[key]));
};

import { renderHook, act } from '@testing-library/react';
import { useDirtyForm } from '../src/hooks/useDirtyForm';

describe('useDirtyForm', () => {
  const initial = { name: 'Ana', notes: '', items: [{ id: 1, qty: 1 }] };

  it('is not dirty when there is no initial snapshot', () => {
    const { result } = renderHook(() => useDirtyForm({ name: 'Ana' }, null));
    expect(result.current.isDirty).toBe(false);
  });

  it('is not dirty when values match the snapshot', () => {
    const { result } = renderHook(() => useDirtyForm({ ...initial }, initial));
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty when a field changes', () => {
    const { result, rerender } = renderHook(
      ({ values, snapshot }) => useDirtyForm(values, snapshot),
      { initialProps: { values: { ...initial }, snapshot: initial } },
    );
    expect(result.current.isDirty).toBe(false);

    act(() => {});
    rerender({
      values: { ...initial, name: 'Bia' },
      snapshot: initial,
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes dirty when an item inside the array changes', () => {
    const { result, rerender } = renderHook(
      ({ values, snapshot }) => useDirtyForm(values, snapshot),
      { initialProps: { values: { ...initial }, snapshot: initial } },
    );
    rerender({
      values: { ...initial, items: [{ id: 1, qty: 2 }] },
      snapshot: initial,
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('becomes dirty when an item is added to the array', () => {
    const { result, rerender } = renderHook(
      ({ values, snapshot }) => useDirtyForm(values, snapshot),
      { initialProps: { values: { ...initial }, snapshot: initial } },
    );
    rerender({
      values: {
        ...initial,
        items: [
          { id: 1, qty: 1 },
          { id: 2, qty: 1 },
        ],
      },
      snapshot: initial,
    });
    expect(result.current.isDirty).toBe(true);
  });

  it('clears dirty state when the snapshot is reset (form closed/reopened)', () => {
    const { result, rerender } = renderHook(
      ({ values, snapshot }) => useDirtyForm(values, snapshot),
      { initialProps: { values: { ...initial }, snapshot: initial } },
    );
    rerender({ values: { ...initial, name: 'Bia' }, snapshot: initial });
    expect(result.current.isDirty).toBe(true);

    const fresh = { name: 'Bia', notes: '', items: [{ id: 1, qty: 1 }] };
    rerender({ values: { ...fresh }, snapshot: fresh });
    expect(result.current.isDirty).toBe(false);
  });
});

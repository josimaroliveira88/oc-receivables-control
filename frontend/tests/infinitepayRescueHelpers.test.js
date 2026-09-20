import { describe, it, expect } from 'vitest';
import {
  assignmentTotalCents,
  buildInitialAssignments,
  defaultAssignmentCents,
  isRescueBalanced,
  mergeAssignments,
} from '../src/pages/Sales/utils/infinitepayRescueHelpers';

const match = (saleId, extra = {}) => ({
  saleId,
  orderNumber: `V-${saleId}`,
  suggestedCents: 22001,
  ...extra,
});

const deposit = (amountCents, matches) => ({
  amountCents,
  matches,
});

describe('infinitepayRescueHelpers', () => {
  it('defaults the amount to the rescuable balance', () => {
    expect(
      defaultAssignmentCents({ rescuableCents: 12000, pendingCents: 5000 }),
    ).toBe(12000);
    expect(
      defaultAssignmentCents({ rescuableCents: 0, pendingCents: 5000 }),
    ).toBe(5000);
  });

  it('sums assignment amounts', () => {
    expect(
      assignmentTotalCents([
        { orderId: 'a', amountCents: 100 },
        { orderId: 'b', amountCents: 250 },
      ]),
    ).toBe(350);
    expect(assignmentTotalCents(undefined)).toBe(0);
  });

  it('checks the balance within the 2-cent tolerance', () => {
    expect(isRescueBalanced([{ amountCents: 22001 }], 22001)).toBe(true);
    expect(isRescueBalanced([{ amountCents: 22003 }], 22001)).toBe(true);
    expect(isRescueBalanced([{ amountCents: 22004 }], 22001)).toBe(false);
    expect(isRescueBalanced([], 22001)).toBe(false);
  });

  it('merges assignments that target the same sale', () => {
    expect(
      mergeAssignments([
        { orderId: 'a', amountCents: 100 },
        { orderId: 'b', amountCents: 200 },
        { orderId: 'a', amountCents: 50 },
      ]),
    ).toEqual([
      { orderId: 'a', amountCents: 150 },
      { orderId: 'b', amountCents: 200 },
    ]);
  });

  it('auto-assigns a rescue with a single matching sale', () => {
    const assignments = buildInitialAssignments([
      {
        line: 2,
        amountCents: 22001,
        matches: [match('s1')],
        paired: false,
        sourceDeposits: [],
      },
    ]);
    expect(assignments).toEqual({
      2: [{ orderId: 's1', amountCents: 22001 }],
    });
  });

  it('leaves a rescue with multiple matching sales for the user', () => {
    const assignments = buildInitialAssignments([
      {
        line: 2,
        amountCents: 22001,
        matches: [match('s1'), match('s2')],
        paired: false,
        sourceDeposits: [],
      },
    ]);
    expect(assignments).toEqual({});
  });

  it('auto-assigns a bundled rescue when every deposit has one match', () => {
    const assignments = buildInitialAssignments([
      {
        line: 2,
        amountCents: 49532,
        matches: [],
        paired: true,
        sourceDeposits: [
          deposit(33415, [match('s1')]),
          deposit(16117, [match('s2')]),
        ],
      },
    ]);
    expect(assignments).toEqual({
      2: [
        { orderId: 's1', amountCents: 33415 },
        { orderId: 's2', amountCents: 16117 },
      ],
    });
  });

  it('leaves a bundled rescue unassigned when a deposit is ambiguous', () => {
    const assignments = buildInitialAssignments([
      {
        line: 2,
        amountCents: 49532,
        matches: [],
        paired: true,
        sourceDeposits: [deposit(33415, [match('s1'), match('s2')])],
      },
    ]);
    expect(assignments).toEqual({});
  });
});

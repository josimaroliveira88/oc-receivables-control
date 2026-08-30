import { describe, it, expect } from 'vitest';
import {
  filterAndSortPeople,
  birthMonthOf,
} from '../src/pages/People/utils/peopleHelpers';

const person = (overrides) => ({
  id: '1',
  name: 'João Silva',
  whatsapp: null,
  instagram: null,
  birthday: null,
  isVip: false,
  isDoterraMember: false,
  ...overrides,
});

describe('birthMonthOf', () => {
  it('returns the month number from a DD/MM string', () => {
    expect(birthMonthOf('15/08')).toBe(8);
    expect(birthMonthOf('01/01')).toBe(1);
    expect(birthMonthOf('31/12')).toBe(12);
  });

  it('returns null for missing or invalid birthdays', () => {
    expect(birthMonthOf(null)).toBeNull();
    expect(birthMonthOf('')).toBeNull();
    expect(birthMonthOf('not-a-date')).toBeNull();
  });
});

describe('filterAndSortPeople', () => {
  it('should sort by name ascending by default', () => {
    const people = [
      person({ id: '1', name: 'Zeca' }),
      person({ id: '2', name: 'Ana' }),
    ];
    const result = filterAndSortPeople(people, '', '', 'name', 'asc');
    expect(result.map((p) => p.name)).toEqual(['Ana', 'Zeca']);
  });

  describe('birthdayOnly filter', () => {
    const people = [
      person({ id: '1', name: 'Janeiro', birthday: '05/01' }),
      person({ id: '2', name: 'Março', birthday: '10/03' }),
      person({ id: '3', name: 'Agosto', birthday: '15/08' }),
      person({ id: '4', name: 'Sem Aniversario', birthday: null }),
      person({ id: '5', name: 'Agosto Tarde', birthday: '25/08' }),
    ];

    it('should return everyone when birthdayOnly is false', () => {
      const result = filterAndSortPeople(
        people,
        '',
        '',
        'name',
        'asc',
        false,
        8,
      );
      expect(result).toHaveLength(5);
    });

    it('should keep only people whose birthday matches the current month', () => {
      const result = filterAndSortPeople(
        people,
        '',
        '',
        'name',
        'asc',
        true,
        8,
      );
      expect(result.map((p) => p.name)).toEqual(['Agosto', 'Agosto Tarde']);
    });

    it('should return no rows when no one has a birthday in the current month', () => {
      const result = filterAndSortPeople(
        people,
        '',
        '',
        'name',
        'asc',
        true,
        6,
      );
      expect(result).toEqual([]);
    });

    it('should combine the birthday filter with the search query', () => {
      const result = filterAndSortPeople(
        people,
        'tarde',
        '',
        'name',
        'asc',
        true,
        8,
      );
      expect(result.map((p) => p.name)).toEqual(['Agosto Tarde']);
    });

    it('should combine the birthday filter with the classification filter', () => {
      const vipAugust = {
        id: '6',
        name: 'Agosto VIP',
        birthday: '02/08',
        isVip: true,
        isDoterraMember: false,
      };
      const result = filterAndSortPeople(
        [...people, vipAugust],
        '',
        'vip',
        'name',
        'asc',
        true,
        8,
      );
      expect(result.map((p) => p.name)).toEqual(['Agosto VIP']);
    });
  });
});

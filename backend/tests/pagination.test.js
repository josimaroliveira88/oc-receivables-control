const { paginate } = require('../src/utils/pagination');

const items = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('pagination util', () => {
  describe('paginate', () => {
    it('defaults to page 1 and pageSize 20', () => {
      const result = paginate(items(45), {});

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 45,
        totalPages: 3,
        hasMore: true,
      });
      expect(result.data).toHaveLength(20);
      expect(result.data[0]).toEqual({ id: 1 });
    });

    it('parses numeric string page and pageSize like query params', () => {
      const result = paginate(items(4), { page: '2', pageSize: '2' });

      expect(result.pagination).toEqual({
        page: 2,
        pageSize: 2,
        total: 4,
        totalPages: 2,
        hasMore: false,
      });
      expect(result.data.map((i) => i.id)).toEqual([3, 4]);
    });

    it('accepts numeric page and pageSize values', () => {
      const result = paginate(items(4), { page: 2, pageSize: 3 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.pageSize).toBe(3);
      expect(result.data.map((i) => i.id)).toEqual([4]);
    });

    it('clamps pageSize to maxPageSize', () => {
      const result = paginate(items(150), { pageSize: '1000' });

      expect(result.pagination.pageSize).toBe(100);
      expect(result.data).toHaveLength(100);
    });

    it('honors a custom maxPageSize', () => {
      const result = paginate(items(150), {
        pageSize: '1000',
        maxPageSize: 50,
      });

      expect(result.pagination.pageSize).toBe(50);
    });

    it('falls back to defaultPageSize for zero and clamps negatives to 1', () => {
      const zero = paginate(items(3), { pageSize: '0' });
      expect(zero.pagination.pageSize).toBe(20);

      const negative = paginate(items(3), { pageSize: '-5' });
      expect(negative.pagination.pageSize).toBe(1);
      expect(negative.data).toHaveLength(1);
    });

    it('falls back to defaultPageSize for invalid pageSize values', () => {
      const result = paginate(items(45), { pageSize: 'abc' });

      expect(result.pagination.pageSize).toBe(20);
    });

    it('honors a custom defaultPageSize', () => {
      const result = paginate(items(45), {
        pageSize: 'abc',
        defaultPageSize: 5,
      });

      expect(result.pagination.pageSize).toBe(5);
    });

    it('clamps invalid page values to 1', () => {
      for (const page of ['abc', '0', '-2', undefined]) {
        const result = paginate(items(4), { page, pageSize: '2' });
        expect(result.pagination.page).toBe(1);
        expect(result.data.map((i) => i.id)).toEqual([1, 2]);
      }
    });

    it('returns all items when pageSize is "all"', () => {
      const result = paginate(items(4), { pageSize: 'all' });

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 4,
        total: 4,
        totalPages: 1,
        hasMore: false,
      });
      expect(result.data).toHaveLength(4);
    });

    it('returns pageSize 1 for "all" on an empty list', () => {
      const result = paginate([], { pageSize: 'all' });

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 1,
        total: 0,
        totalPages: 1,
        hasMore: false,
      });
      expect(result.data).toEqual([]);
    });

    it('keeps totalPages at 1 for an empty list with defaults', () => {
      const result = paginate([], {});

      expect(result.pagination).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        hasMore: false,
      });
    });

    it('returns empty data for a page beyond the last one', () => {
      const result = paginate(items(4), { page: '5', pageSize: '2' });

      expect(result.pagination).toEqual({
        page: 5,
        pageSize: 2,
        total: 4,
        totalPages: 2,
        hasMore: false,
      });
      expect(result.data).toEqual([]);
    });

    it('does not mutate the input array', () => {
      const list = items(4);
      const result = paginate(list, { page: '2', pageSize: '2' });

      expect(list).toHaveLength(4);
      expect(result.data).not.toBe(list);
    });
  });
});

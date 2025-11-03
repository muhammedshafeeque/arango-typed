import { isNewDocument, extractKey, extractCollection, isPlainObject, deepClone, deepMerge } from '../../src/utils/helpers';

describe('Helpers', () => {
  describe('isNewDocument', () => {
    it('should return true for new document', () => {
      expect(isNewDocument({})).toBe(true);
      expect(isNewDocument({ name: 'Test' })).toBe(true);
    });

    it('should return false for existing document', () => {
      expect(isNewDocument({ _id: 'users/123' })).toBe(false);
      expect(isNewDocument({ _key: '123' })).toBe(false);
    });
  });

  describe('extractKey', () => {
    it('should extract key from _id', () => {
      expect(extractKey('users/123')).toBe('123');
    });

    it('should return id if no separator', () => {
      expect(extractKey('123')).toBe('123');
    });
  });

  describe('extractCollection', () => {
    it('should extract collection from _id', () => {
      expect(extractCollection('users/123')).toBe('users');
    });

    it('should return empty string if no separator', () => {
      expect(extractCollection('123')).toBe('');
    });
  });

  describe('isPlainObject', () => {
    it('should return true for plain objects', () => {
      expect(isPlainObject({})).toBe(true);
      expect(isPlainObject({ a: 1 })).toBe(true);
    });

    it('should return false for arrays', () => {
      expect(isPlainObject([])).toBe(false);
    });

    it('should return false for dates', () => {
      expect(isPlainObject(new Date())).toBe(false);
    });

    it('should return false for null', () => {
      expect(isPlainObject(null)).toBe(false);
    });
  });

  describe('deepClone', () => {
    it('should clone simple object', () => {
      const obj = { a: 1, b: 'test' };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
    });

    it('should clone nested objects', () => {
      const obj = { a: { b: { c: 1 } } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.a).not.toBe(obj.a);
    });

    it('should clone arrays', () => {
      const obj = { arr: [1, 2, { a: 3 }] };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned.arr).not.toBe(obj.arr);
    });

    it('should clone dates', () => {
      const date = new Date();
      const obj = { date };
      const cloned = deepClone(obj);

      expect(cloned.date).toEqual(date);
      expect(cloned.date).not.toBe(date);
    });
  });

  describe('deepMerge', () => {
    it('should merge simple objects', () => {
      const target = { a: 1, b: 2 };
      const source = { b: 3, c: 4 };
      const merged = deepMerge(target, source);

      expect(merged).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const target: { a: { b: number; c: number } } = { a: { b: 1, c: 2 } };
      const source: Partial<typeof target> = { a: { b: 3, d: 4 } as any };
      const merged = deepMerge(target, source);

      expect(merged.a.b).toBe(3);
      expect(merged.a.c).toBe(2);
      expect((merged.a as any).d).toBe(4);
    });
  });
});


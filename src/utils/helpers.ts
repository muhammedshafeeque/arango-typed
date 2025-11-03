import { ArangoDocument } from '../types';

/**
 * Extract _key from _id
 */
export function extractKey(id: string): string {
  if (id.includes('/')) {
    return id.split('/')[1];
  }
  return id;
}

/**
 * Extract collection name from _id
 */
export function extractCollection(id: string): string {
  if (id.includes('/')) {
    return id.split('/')[0];
  }
  return '';
}

/**
 * Check if a value is a plain object
 */
export function isPlainObject(value: any): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as any;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as any;
  }

  const cloned = {} as T;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }

  return cloned;
}

/**
 * Merge two objects deeply
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (sourceValue !== undefined) {
        if (isPlainObject(sourceValue) && isPlainObject(targetValue) && targetValue !== undefined) {
          output[key] = deepMerge(targetValue, sourceValue as Partial<typeof targetValue>);
        } else {
          output[key] = sourceValue as any;
        }
      }
    }
  }

  return output;
}

/**
 * Apply default values from schema
 */
export function applyDefaults(data: Record<string, any>, defaults: Record<string, any>): Record<string, any> {
  const result = { ...data };
  
  for (const key in defaults) {
    if (result[key] === undefined) {
      const defaultValue = defaults[key];
      if (typeof defaultValue === 'function') {
        result[key] = defaultValue();
      } else {
        result[key] = defaultValue;
      }
    }
  }

  return result;
}

/**
 * Apply getters from schema
 */
export function applyGetters(data: Record<string, any>, getters: Record<string, (value: any) => any>): Record<string, any> {
  const result = { ...data };
  
  for (const key in getters) {
    if (result[key] !== undefined) {
      result[key] = getters[key](result[key]);
    }
  }

  return result;
}

/**
 * Check if document is new (has no _id)
 */
export function isNewDocument(doc: ArangoDocument): boolean {
  return !doc._id && !doc._key;
}


import { SchemaFieldDefinition } from '../types/schemas';

export class SchemaType {
  static String(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'String', ...options };
  }

  static Number(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'Number', ...options };
  }

  static Date(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'Date', ...options };
  }

  static Boolean(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'Boolean', ...options };
  }

  static Array(of?: SchemaFieldDefinition | string, options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { 
      type: 'Array', 
      ...(typeof of === 'object' ? { of } : {}),
      ...options 
    };
  }

  static Object(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'Object', ...options };
  }

  static Mixed(options?: Partial<SchemaFieldDefinition>): SchemaFieldDefinition {
    return { type: 'Mixed', ...options };
  }
}


import { SchemaFieldDefinition } from '../types/schemas';

export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export async function validateField(
  fieldName: string,
  value: any,
  definition: SchemaFieldDefinition
): Promise<string | null> {
  // Check required
  if (definition.required && (value === undefined || value === null)) {
    return `${fieldName} is required`;
  }

  // Skip validation if value is undefined/null and not required
  if (value === undefined || value === null) {
    return null;
  }

  // Type validation
  const typeError = validateType(fieldName, value, definition.type);
  if (typeError) return typeError;

  // String validations
  if (definition.type === 'String' && typeof value === 'string') {
    if (definition.minLength !== undefined && value.length < definition.minLength) {
      return `${fieldName} must be at least ${definition.minLength} characters`;
    }
    if (definition.maxLength !== undefined && value.length > definition.maxLength) {
      return `${fieldName} must be at most ${definition.maxLength} characters`;
    }
    if (definition.match && !definition.match.test(value)) {
      return `${fieldName} does not match the required pattern`;
    }
  }

  // Number validations
  if (definition.type === 'Number' && typeof value === 'number') {
    if (definition.min !== undefined && value < definition.min) {
      return `${fieldName} must be at least ${definition.min}`;
    }
    if (definition.max !== undefined && value > definition.max) {
      return `${fieldName} must be at most ${definition.max}`;
    }
  }

  // Enum validation
  if (definition.enum && !definition.enum.includes(value)) {
    return `${fieldName} must be one of: ${definition.enum.join(', ')}`;
  }

  // Custom validator
  if (definition.validate) {
    const result = await definition.validate(value);
    if (result !== true) {
      return typeof result === 'string' ? result : `${fieldName} validation failed`;
    }
  }

  return null;
}

function validateType(fieldName: string, value: any, type: any): string | null {
  if (Array.isArray(type)) {
    // Union types - check if value matches any type
    const matches = type.some((t: any) => {
      if (typeof t === 'string') {
        return checkBasicType(value, t);
      }
      return false;
    });
    if (!matches) {
      return `${fieldName} has invalid type`;
    }
    return null;
  }

  if (typeof type === 'object' && type.type) {
    // Nested schema
    return null; // Will be validated recursively
  }

  if (typeof type === 'string') {
    if (!checkBasicType(value, type)) {
      return `${fieldName} must be of type ${type}`;
    }
  }

  return null;
}

function checkBasicType(value: any, type: string): boolean {
  switch (type) {
    case 'String':
      return typeof value === 'string';
    case 'Number':
      return typeof value === 'number' && !isNaN(value);
    case 'Boolean':
      return typeof value === 'boolean';
    case 'Date':
      return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
    case 'Array':
      return Array.isArray(value);
    case 'Object':
      return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);
    case 'Mixed':
      return true; // Mixed accepts any type
    default:
      return false;
  }
}

export async function validateDocument(
  data: Record<string, any>,
  schema: Record<string, SchemaFieldDefinition>,
  options: { strict?: boolean } = {}
): Promise<ValidationResult> {
  const errors: Record<string, string> = {};
  const fields = new Set([...Object.keys(data), ...Object.keys(schema)]);

  for (const fieldName of fields) {
    const definition = schema[fieldName];
    if (!definition) {
      if (options.strict) {
        errors[fieldName] = `${fieldName} is not defined in schema`;
      }
      continue;
    }

    const value = data[fieldName];
    const error = await validateField(fieldName, value, definition);
    if (error) {
      errors[fieldName] = error;
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}


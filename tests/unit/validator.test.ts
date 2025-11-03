import { validateField, validateDocument } from '../../src/utils/validator';
import { SchemaFieldDefinition } from '../../src/types/schemas';

describe('Validator', () => {
  describe('validateField', () => {
    it('should validate required fields', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        required: true,
      };

      const error = await validateField('name', undefined, definition);
      expect(error).toBe('name is required');
    });

    it('should pass validation for optional fields', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
      };

      const error = await validateField('name', undefined, definition);
      expect(error).toBeNull();
    });

    it('should validate string minLength', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        minLength: 5,
      };

      const error = await validateField('name', 'abc', definition);
      expect(error).toContain('at least 5 characters');
    });

    it('should validate string maxLength', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        maxLength: 10,
      };

      const error = await validateField('name', 'this is too long', definition);
      expect(error).toContain('at most 10 characters');
    });

    it('should validate number min', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'Number',
        min: 0,
      };

      const error = await validateField('age', -1, definition);
      expect(error).toContain('at least 0');
    });

    it('should validate number max', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'Number',
        max: 100,
      };

      const error = await validateField('age', 101, definition);
      expect(error).toContain('at most 100');
    });

    it('should validate enum', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        enum: ['red', 'green', 'blue'],
      };

      const error = await validateField('color', 'yellow', definition);
      expect(error).toContain('one of: red, green, blue');
    });

    it('should validate with custom validator', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        validate: (value: string) => value.length > 5 || 'Too short',
      };

      const error = await validateField('name', 'abc', definition);
      expect(error).toBe('Too short');
    });

    it('should pass custom validator when valid', async () => {
      const definition: SchemaFieldDefinition = {
        type: 'String',
        validate: (value: string) => value.length > 5 || 'Too short',
      };

      const error = await validateField('name', 'abcdef', definition);
      expect(error).toBeNull();
    });
  });

  describe('validateDocument', () => {
    it('should validate a complete document', async () => {
      const schema: Record<string, any> = {
        name: { type: 'String' as const, required: true },
        age: { type: 'Number' as const, min: 0 },
      };

      const data = { name: 'John', age: 25 };
      const result = await validateDocument(data, schema);

      expect(result.valid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return errors for invalid document', async () => {
      const schema: Record<string, any> = {
        name: { type: 'String' as const, required: true },
        age: { type: 'Number' as const, min: 0 },
      };

      const data = { age: -5 };
      const result = await validateDocument(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.name).toBeDefined();
      expect(result.errors.age).toBeDefined();
    });
  });
});


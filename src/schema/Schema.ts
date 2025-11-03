import { SchemaDefinition, SchemaFieldDefinition, IndexDefinition, VirtualFieldDefinition } from '../types/schemas';
import { validateDocument } from '../utils/validator';
import { applyDefaults, applyGetters } from '../utils/helpers';
import { HookRegistry } from '../utils/hooks';
import { PluginFunction } from '../plugin/Plugin';

export class Schema {
  public paths: Record<string, SchemaFieldDefinition>;
  public indexes: IndexDefinition[];
  public virtuals: Record<string, VirtualFieldDefinition>;
  public hooks: HookRegistry;
  public getters: Record<string, (value: any) => any>;
  public setters: Record<string, (value: any) => any>;

  constructor(definition: SchemaDefinition, _options: { strict?: boolean } = {}) {
    this.paths = {};
    this.indexes = [];
    this.virtuals = {};
    this.hooks = new HookRegistry();
    this.getters = {};
    this.setters = {};

    this.buildPaths(definition);
  }

  private buildPaths(definition: SchemaDefinition): void {
    for (const [key, value] of Object.entries(definition)) {
      if (typeof value === 'string') {
        // Mongoose-like shorthand: { name: 'String' }
        this.paths[key] = { type: value as any };
      } else if (typeof value === 'function' && (value === String || value === Number || value === Boolean || value === Date || value === Array || value === Object)) {
        // Mongoose-like shorthand: { name: String, age: Number }
        let type: string;
        if (value === String) type = 'String';
        else if (value === Number) type = 'Number';
        else if (value === Boolean) type = 'Boolean';
        else if (value === Date) type = 'Date';
        else if (value === Array) type = 'Array';
        else if (value === Object) type = 'Object';
        else type = 'Any';
        
        this.paths[key] = { type: type as any };
      } else if (value && typeof value === 'object') {
        // Complex definition like { name: { type: 'String', required: true } }
        this.paths[key] = value as SchemaFieldDefinition;
        
        // Extract getter/setter
        if (value.get) {
          this.getters[key] = value.get;
        }
        if (value.set) {
          this.setters[key] = value.set;
        }

        // Extract index definitions
        if (value.index) {
          const indexType = typeof value.index === 'string' ? value.index : 'persistent';
          this.indexes.push({
            type: indexType === 'text' ? 'fulltext' : indexType === 'geo' ? 'geo' : 'persistent',
            fields: [key],
            unique: value.unique || false,
            sparse: value.sparse || false,
          });
        }

        if (value.unique && !value.index) {
          this.indexes.push({
            type: 'persistent',
            fields: [key],
            unique: true,
            sparse: value.sparse || false,
          });
        }
      }
    }
  }

  /**
   * Add a virtual field
   */
  virtual(name: string, definition?: VirtualFieldDefinition): this {
    if (definition) {
      this.virtuals[name] = definition;
    } else {
      this.virtuals[name] = {} as VirtualFieldDefinition;
    }
    return this;
  }

  /**
   * Add an index
   */
  index(fields: string | string[], options?: Partial<IndexDefinition>): this {
    const fieldArray = Array.isArray(fields) ? fields : [fields];
    this.indexes.push({
      type: 'persistent',
      fields: fieldArray,
      unique: false,
      sparse: false,
      ...options,
    });
    return this;
  }

  /**
   * Add a pre hook
   */
  pre(type: 'save' | 'remove' | 'validate' | 'init', callback: (doc: any) => void | Promise<void>): this {
    this.hooks.pre(type, callback);
    return this;
  }

  /**
   * Add a post hook
   */
  post(type: 'save' | 'remove' | 'validate' | 'init', callback: (doc: any) => void | Promise<void>): this {
    this.hooks.post(type, callback);
    return this;
  }

  // Compiled validator cache (performance optimization)
  private compiledValidators: Map<string, (value: any) => string | null> = new Map();

  /**
   * Validate a document against this schema
   */
  async validate(data: Record<string, any>, options: { strict?: boolean } = {}): Promise<void> {
    const result = await validateDocument(data, this.paths, options);
    if (!result.valid) {
      const { ValidationError } = await import('../errors/ArangoError');
      throw new ValidationError('Validation failed', result.errors);
    }
  }

  /**
   * Synchronous validation (faster, no async validators)
   * Optimized for performance - skips async custom validators
   */
  validateSync(data: Record<string, any>): void {
    const errors: Record<string, string> = {};

    for (const [fieldName, definition] of Object.entries(this.paths)) {
      const value = data[fieldName];

      // Check required
      if (definition.required && (value === undefined || value === null)) {
        errors[fieldName] = `${fieldName} is required`;
        continue;
      }

      // Skip validation if value is undefined/null and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Use compiled validator if available
      const cacheKey = `${fieldName}:${JSON.stringify(definition)}`;
      let validator = this.compiledValidators.get(cacheKey);

      if (!validator) {
        // Compile validator once
        validator = this.compileValidator(fieldName, definition);
        this.compiledValidators.set(cacheKey, validator);
      }

      const error = validator(value);
      if (error) {
        errors[fieldName] = error;
      }
    }

    if (Object.keys(errors).length > 0) {
      const { ValidationError } = require('../errors/ArangoError');
      throw new ValidationError('Validation failed', errors);
    }
  }

  /**
   * Compile a validator function for a field (performance optimization)
   */
  private compileValidator(fieldName: string, definition: SchemaFieldDefinition): (value: any) => string | null {
    return (value: any): string | null => {
      // Type validation
      const type = definition.type;
      if (type === 'String' && typeof value !== 'string') {
        return `${fieldName} must be a string`;
      }
      if (type === 'Number' && typeof value !== 'number') {
        return `${fieldName} must be a number`;
      }
      if (type === 'Boolean' && typeof value !== 'boolean') {
        return `${fieldName} must be a boolean`;
      }
      if (type === 'Date' && !(value instanceof Date)) {
        return `${fieldName} must be a date`;
      }
      if (type === 'Array' && !Array.isArray(value)) {
        return `${fieldName} must be an array`;
      }
      if (type === 'Object' && (typeof value !== 'object' || Array.isArray(value) || value === null)) {
        return `${fieldName} must be an object`;
      }

      // String validations
      if (type === 'String' && typeof value === 'string') {
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
      if (type === 'Number' && typeof value === 'number') {
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

      // Skip async custom validators in sync mode
      return null;
    };
  }

  /**
   * Apply defaults to a document
   */
  applyDefaults(data: Record<string, any>): Record<string, any> {
    const defaults: Record<string, any> = {};
    for (const [key, definition] of Object.entries(this.paths)) {
      if (definition.default !== undefined) {
        defaults[key] = definition.default;
      }
    }
    return applyDefaults(data, defaults);
  }

  /**
   * Apply getters to a document
   */
  applyGetters(data: Record<string, any>): Record<string, any> {
    return applyGetters(data, this.getters);
  }

  /**
   * Apply setters to incoming data
   */
  applySetters(data: Record<string, any>): Record<string, any> {
    const result = { ...data };
    for (const [key, setter] of Object.entries(this.setters)) {
      if (result[key] !== undefined) {
        result[key] = setter(result[key]);
      }
    }
    return result;
  }

  /**
   * Apply a plugin to this schema
   */
  plugin(fn: PluginFunction, options?: any): this {
    fn(this, options);
    return this;
  }
}


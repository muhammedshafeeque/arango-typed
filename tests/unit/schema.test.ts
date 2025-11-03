import { Schema, SchemaType } from '../../src';

describe('Schema', () => {
  it('should create a schema with simple types', () => {
    const schema = new Schema({
      name: 'String',
      age: 'Number',
      active: 'Boolean',
    });

    expect(schema.paths).toBeDefined();
    expect(schema.paths.name.type).toBe('String');
    expect(schema.paths.age.type).toBe('Number');
    expect(schema.paths.active.type).toBe('Boolean');
  });

  it('should create a schema with complex definitions', () => {
    const schema = new Schema({
      name: { type: 'String', required: true },
      age: { type: 'Number', min: 0, max: 150 },
      email: { type: 'String', match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    });

    expect(schema.paths.name.required).toBe(true);
    expect(schema.paths.age.min).toBe(0);
    expect(schema.paths.age.max).toBe(150);
    expect(schema.paths.email.match).toBeInstanceOf(RegExp);
  });

  it('should apply defaults', () => {
    const schema = new Schema({
      name: { type: 'String', default: 'Unknown' },
      age: { type: 'Number', default: 0 },
    });

    const data = {};
    const result = schema.applyDefaults(data);

    expect(result.name).toBe('Unknown');
    expect(result.age).toBe(0);
  });

  it('should add virtual fields', () => {
    const schema = new Schema({
      firstName: 'String',
      lastName: 'String',
    });

    schema.virtual('fullName', {
      get(this: any) {
        return `${this.firstName} ${this.lastName}`;
      },
    });

    expect(schema.virtuals.fullName).toBeDefined();
  });

  it('should add indexes', () => {
    const schema = new Schema({
      email: 'String',
      name: 'String',
    });

    schema.index('email', { unique: true });
    schema.index(['name', 'email']);

    expect(schema.indexes.length).toBe(2);
    expect(schema.indexes[0].unique).toBe(true);
    expect(schema.indexes[1].fields).toEqual(['name', 'email']);
  });

  it('should register hooks', () => {
    const schema = new Schema({
      name: 'String',
    });

    const preSaveHook = jest.fn();
    const postSaveHook = jest.fn();

    schema.pre('save', preSaveHook);
    schema.post('save', postSaveHook);

    expect(schema.hooks).toBeDefined();
  });
});

describe('SchemaType', () => {
  it('should create String type', () => {
    const type = SchemaType.String({ required: true });
    expect(type.type).toBe('String');
    expect(type.required).toBe(true);
  });

  it('should create Array type', () => {
    const type = SchemaType.Array(SchemaType.String());
    expect(type.type).toBe('Array');
    expect(type.of).toBeDefined();
  });
});


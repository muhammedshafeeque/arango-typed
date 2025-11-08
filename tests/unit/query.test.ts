import { QueryBuilder } from '../../src/query/QueryBuilder';

describe('QueryBuilder', () => {
  it('should build simple query', () => {
    const builder = new QueryBuilder('users');
    const { query, bindVars } = builder.buildAQL();

    expect(query).toContain('FOR doc IN @@collection');
    expect(query).toContain('RETURN doc');
    expect(bindVars['@collection']).toBe('users');
  });

  it('should build query with where clause', () => {
    const builder = new QueryBuilder('users')
      .where({ name: 'John', age: 25 });

    const { query } = builder.buildAQL();

    expect(query).toContain('FILTER');
    expect(query).toContain('doc.name');
    expect(query).toContain('doc.age');
  });

  it('should build query with limit', () => {
    const builder = new QueryBuilder('users')
      .limit(10);

    const { query } = builder.buildAQL();

    expect(query).toContain('LIMIT 10');
  });

  it('should build query with skip and limit', () => {
    const builder = new QueryBuilder('users')
      .skip(5)
      .limit(10);

    const { query } = builder.buildAQL();

    expect(query).toContain('LIMIT 5, 10');
  });

  it('should build query with sort', () => {
    const builder = new QueryBuilder('users')
      .sort({ name: 1, age: -1 });

    const { query } = builder.buildAQL();

    expect(query).toContain('SORT');
    expect(query).toContain('ASC');
    expect(query).toContain('DESC');
  });

  it('should build query with select', () => {
    const builder = new QueryBuilder('users')
      .select(['name', 'email']);

    const { query } = builder.buildAQL();

    expect(query).toContain('RETURN');
    expect(query).toContain('doc.name');
    expect(query).toContain('doc.email');
  });

  it('should chain multiple conditions', () => {
    const builder = new QueryBuilder('users')
      .where({ active: true })
      .sort({ name: 1 })
      .limit(10)
      .skip(5);

    const { query } = builder.buildAQL();

    expect(query).toContain('FILTER');
    expect(query).toContain('SORT');
    expect(query).toContain('LIMIT 5, 10');
  });

  it('should use partial text search for fields ending with Contains', () => {
    const builder = new QueryBuilder('users')
      .where({ nameContains: 'john', codeContains: 'ABC' });

    const { query } = builder.buildAQL();

    // Should use LIKE for partial text search
    expect(query).toContain('LOWER(doc.name) LIKE');
    expect(query).toContain('LOWER(doc.code) LIKE');
    expect(query).toContain('CONCAT');
    // Should search for actual field names (name, code), not nameContains/codeContains
    expect(query).toContain('doc.name');
    expect(query).toContain('doc.code');
    expect(query).not.toContain('nameContains');
    expect(query).not.toContain('codeContains');
  });

  it('should use exact match for regular fields', () => {
    const builder = new QueryBuilder('users')
      .where({ name: 'John', age: 25 });

    const { query } = builder.buildAQL();

    // Should use exact match (==) for regular fields
    expect(query).toContain('doc.name ==');
    expect(query).toContain('doc.age ==');
    expect(query).not.toContain('LIKE');
  });

  it('should support nested fields with Contains suffix', () => {
    const builder = new QueryBuilder('users')
      .where({ 'user.emailContains': 'gmail' });

    const { query } = builder.buildAQL();

    // Should use LIKE for nested field
    expect(query).toContain("LOWER(doc['user']['email']) LIKE");
    expect(query).not.toContain('emailContains');
  });
});


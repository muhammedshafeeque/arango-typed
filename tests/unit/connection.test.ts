import { Connection } from '../../src/connection/Connection';

describe('Connection', () => {
  const mockOptions = {
    url: 'http://localhost:8529',
    databaseName: 'test',
  };

  it('should create a connection instance', () => {
    const connection = new Connection(mockOptions);

    expect(connection).toBeInstanceOf(Connection);
  });

  it('should not be connected initially', () => {
    const connection = new Connection(mockOptions);

    expect(connection.isConnected()).toBe(false);
  });

  it('should throw error when getting database without connecting', () => {
    const connection = new Connection(mockOptions);

    expect(() => connection.getDatabase()).toThrow('Not connected');
  });

  it('should allow setting database name', () => {
    const connection = new Connection({
      ...mockOptions,
      databaseName: 'test',
    });

    expect(connection).toBeDefined();
  });

  it('should handle connection options with auth', () => {
    const connection = new Connection({
      ...mockOptions,
      auth: {
        username: 'test',
        password: 'test',
      },
    });

    expect(connection).toBeDefined();
  });
});


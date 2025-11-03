export class ArangoError extends Error {
  constructor(message: string, public code?: string, public statusCode?: number) {
    super(message);
    this.name = 'ArangoError';
    Object.setPrototypeOf(this, ArangoError.prototype);
  }
}

export class ValidationError extends ArangoError {
  constructor(message: string, public errors?: Record<string, string>) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'VALIDATION_ERROR';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class ConnectionError extends ArangoError {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionError';
    this.code = 'CONNECTION_ERROR';
    Object.setPrototypeOf(this, ConnectionError.prototype);
  }
}

export class QueryError extends ArangoError {
  constructor(message: string, public query?: string) {
    super(message);
    this.name = 'QueryError';
    this.code = 'QUERY_ERROR';
    Object.setPrototypeOf(this, QueryError.prototype);
  }
}

export class DocumentNotFoundError extends ArangoError {
  constructor(message: string = 'Document not found') {
    super(message);
    this.name = 'DocumentNotFoundError';
    this.code = 'DOCUMENT_NOT_FOUND';
    Object.setPrototypeOf(this, DocumentNotFoundError.prototype);
  }
}

export class VectorSearchError extends ArangoError {
  constructor(message: string, public query?: string) {
    super(message);
    this.name = 'VectorSearchError';
    this.code = 'VECTOR_SEARCH_ERROR';
    Object.setPrototypeOf(this, VectorSearchError.prototype);
  }
}


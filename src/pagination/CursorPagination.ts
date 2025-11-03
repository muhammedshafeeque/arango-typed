export interface CursorPaginationResult<T> {
  data: T[];
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CursorPaginationOptions {
  cursor?: string;
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export class CursorPagination {
  /**
   * Encode cursor from document
   */
  static encodeCursor(doc: any, sortField: string = '_id'): string {
    const value = doc[sortField] || doc._id || doc._key;
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  /**
   * Decode cursor
   */
  static decodeCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch {
      return null;
    }
  }

  /**
   * Paginate with cursor
   */
  static async paginate<T>(
    queryFn: (cursor: any, limit: number, sortField: string, direction: string) => Promise<T[]>,
    options: CursorPaginationOptions = {}
  ): Promise<CursorPaginationResult<T>> {
    const limit = options.limit || 10;
    const sortField = options.sortField || '_id';
    const sortDirection = options.sortDirection || 'asc';
    const cursor = options.cursor ? this.decodeCursor(options.cursor) : null;

    const data = await queryFn(cursor, limit + 1, sortField, sortDirection);

    const hasNext = data.length > limit;
    if (hasNext) {
      data.pop(); // Remove extra item
    }

    const hasPrev = !!cursor;

    let nextCursor: string | undefined;
    let prevCursor: string | undefined;

    if (data.length > 0) {
      if (hasNext) {
        nextCursor = this.encodeCursor(data[data.length - 1], sortField);
      }
      if (hasPrev) {
        prevCursor = this.encodeCursor(data[0], sortField);
      }
    }

    return {
      data,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev,
    };
  }

  /**
   * Generate pagination URLs
   */
  static generateUrls(
    baseUrl: string,
    nextCursor?: string,
    prevCursor?: string
  ): { next?: string; prev?: string } {
    const urls: { next?: string; prev?: string } = {};

    if (nextCursor) {
      urls.next = `${baseUrl}?cursor=${encodeURIComponent(nextCursor)}`;
    }

    if (prevCursor) {
      urls.prev = `${baseUrl}?cursor=${encodeURIComponent(prevCursor)}`;
    }

    return urls;
  }
}



export interface PaginationResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
  returnTotal?: boolean;
}

export class Paginator {
  /**
   * Paginate query results
   */
  static async paginate<T>(
    queryFn: (skip: number, limit: number) => Promise<T[]>,
    countFn?: () => Promise<number>,
    options: PaginationOptions = {}
  ): Promise<PaginationResult<T>> {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      queryFn(skip, pageSize),
      options.returnTotal !== false && countFn ? countFn() : Promise.resolve(0),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Generate pagination metadata
   */
  static generateMetadata(page: number, pageSize: number, total: number) {
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return {
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}



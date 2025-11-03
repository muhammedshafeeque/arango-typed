export interface OperatorMap {
  [key: string]: any;
}

export class Operators {
  /**
   * Greater than or equal
   */
  static $gte(value: number | Date): OperatorMap {
    return { $gte: value };
  }

  /**
   * Less than or equal
   */
  static $lte(value: number | Date): OperatorMap {
    return { $lte: value };
  }

  /**
   * Greater than
   */
  static $gt(value: number | Date): OperatorMap {
    return { $gt: value };
  }

  /**
   * Less than
   */
  static $lt(value: number | Date): OperatorMap {
    return { $lt: value };
  }

  /**
   * Not equal
   */
  static $ne(value: any): OperatorMap {
    return { $ne: value };
  }

  /**
   * Equal
   */
  static $eq(value: any): OperatorMap {
    return { $eq: value };
  }

  /**
   * In array
   */
  static $in(values: any[]): OperatorMap {
    return { $in: values };
  }

  /**
   * Not in array
   */
  static $nin(values: any[]): OperatorMap {
    return { $nin: values };
  }

  /**
   * All elements match
   */
  static $all(values: any[]): OperatorMap {
    return { $all: values };
  }

  /**
   * Array size
   */
  static $size(value: number): OperatorMap {
    return { $size: value };
  }

  /**
   * Element match
   */
  static $elemMatch(query: Record<string, any>): OperatorMap {
    return { $elemMatch: query };
  }

  /**
   * And operator
   */
  static $and(conditions: Record<string, any>[]): OperatorMap {
    return { $and: conditions };
  }

  /**
   * Or operator
   */
  static $or(conditions: Record<string, any>[]): OperatorMap {
    return { $or: conditions };
  }

  /**
   * Not operator
   */
  static $not(condition: Record<string, any>): OperatorMap {
    return { $not: condition };
  }

  /**
   * Nor operator
   */
  static $nor(conditions: Record<string, any>[]): OperatorMap {
    return { $nor: conditions };
  }

  /**
   * Exists operator
   */
  static $exists(value: boolean): OperatorMap {
    return { $exists: value };
  }

  /**
   * Type operator
   */
  static $type(value: string): OperatorMap {
    return { $type: value };
  }

  /**
   * Regex operator
   */
  static $regex(pattern: string, flags?: string): OperatorMap {
    return { $regex: pattern, $options: flags };
  }

  /**
   * Text search operator
   */
  static $text(search: string): OperatorMap {
    return { $text: search };
  }

  /**
   * Convert operator map to AQL condition
   */
  static toAQL(field: string, operatorMap: OperatorMap, varName: string, bindVars: Record<string, any>): string {
    const operator = Object.keys(operatorMap)[0];
    const value = operatorMap[operator];

    switch (operator) {
      case '$gte':
        bindVars[varName] = value;
        return `${field} >= @${varName}`;
      case '$lte':
        bindVars[varName] = value;
        return `${field} <= @${varName}`;
      case '$gt':
        bindVars[varName] = value;
        return `${field} > @${varName}`;
      case '$lt':
        bindVars[varName] = value;
        return `${field} < @${varName}`;
      case '$ne':
        bindVars[varName] = value;
        return `${field} != @${varName}`;
      case '$eq':
        bindVars[varName] = value;
        return `${field} == @${varName}`;
      case '$in':
        bindVars[varName] = value;
        return `${field} IN @${varName}`;
      case '$nin':
        bindVars[varName] = value;
        return `${field} NOT IN @${varName}`;
      case '$all':
        // AQL: ALL elements in array match
        bindVars[varName] = value;
        return `FOR v IN @${varName} FILTER v IN ${field} RETURN true`;
      case '$size':
        return `LENGTH(${field}) == ${value}`;
      case '$exists':
        return value ? `${field} != null` : `${field} == null`;
      case '$regex':
        return `REGEX_TEST(${field}, @${varName}, @${varName}Flags)`;
      default:
        bindVars[varName] = value;
        return `${field} == @${varName}`;
    }
  }
}



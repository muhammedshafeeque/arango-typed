/**
 * Subdocument operations for nested/embedded documents (ODM feature)
 */
export class Subdocument {
  /**
   * Update a subdocument within a parent document
   */
  static async updateSubdocument(
    parentDoc: any,
    subdocPath: string,
    update: Record<string, any>
  ): Promise<void> {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    // Navigate to parent of subdocument
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }

    // Update subdocument
    const subdocKey = pathParts[pathParts.length - 1];
    if (Array.isArray(current[subdocKey])) {
      // Handle array of subdocuments - delegate to updateArraySubdocument
      throw new Error(
        `Cannot update array at path "${subdocPath}" directly. ` +
        `Use updateArraySubdocument() with an index or predicate function.`
      );
    } else {
      current[subdocKey] = { ...current[subdocKey], ...update };
    }
  }

  /**
   * Remove a subdocument from parent
   */
  static removeSubdocument(parentDoc: any, subdocPath: string): void {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    // Navigate to parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        return; // Path doesn't exist
      }
      current = current[pathParts[i]];
    }

    // Remove subdocument
    const subdocKey = pathParts[pathParts.length - 1];
    if (Array.isArray(current[subdocKey])) {
      // Handle array removal by index
      const index = parseInt(subdocKey);
      if (!isNaN(index)) {
        current.splice(index, 1);
      }
    } else {
      delete current[subdocKey];
    }
  }

  /**
   * Get a subdocument from parent
   */
  static getSubdocument(parentDoc: any, subdocPath: string): any {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Push item to array subdocument
   */
  static pushToSubdocument(parentDoc: any, subdocPath: string, item: any): void {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    // Navigate to parent
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }

    // Push to array
    const arrayKey = pathParts[pathParts.length - 1];
    if (!current[arrayKey]) {
      current[arrayKey] = [];
    }
    if (Array.isArray(current[arrayKey])) {
      current[arrayKey].push(item);
    }
  }

  /**
   * Pull item from array subdocument
   */
  static pullFromSubdocument(parentDoc: any, subdocPath: string, condition: (item: any) => boolean): void {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    // Navigate to array
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        return;
      }
      current = current[pathParts[i]];
    }

    const arrayKey = pathParts[pathParts.length - 1];
    if (Array.isArray(current[arrayKey])) {
      current[arrayKey] = current[arrayKey].filter((item: any) => !condition(item));
    }
  }

  /**
   * Update an element in an array subdocument
   * @param parentDoc - The parent document
   * @param subdocPath - Path to the array (e.g., "items" or "nested.items")
   * @param index - Numeric index or predicate function to find the element
   * @param update - The update object to merge with the existing element
   */
  static updateArraySubdocument(
    parentDoc: any,
    subdocPath: string,
    index: number | ((item: any) => boolean),
    update: Record<string, any>
  ): void {
    const pathParts = subdocPath.split('.');
    let current = parentDoc;

    // Navigate to parent of array
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        throw new Error(
          `Path "${subdocPath}" is invalid: segment "${pathParts[i]}" does not exist.`
        );
      }
      current = current[pathParts[i]];
    }

    const arrayKey = pathParts[pathParts.length - 1];
    
    // Validate that path points to an array
    if (!Array.isArray(current[arrayKey])) {
      throw new Error(
        `Path "${subdocPath}" does not point to an array. Found: ${typeof current[arrayKey]}.`
      );
    }

    const arr = current[arrayKey];

    if (typeof index === 'number') {
      // Update by numeric index
      if (index < 0 || index >= arr.length) {
        throw new Error(
          `Index ${index} is out of bounds for array at path "${subdocPath}" (length: ${arr.length}).`
        );
      }
      arr[index] = { ...arr[index], ...update };
    } else {
      // Update by predicate function
      const foundIndex = arr.findIndex(index);
      if (foundIndex === -1) {
        throw new Error(
          `No element found matching predicate in array at path "${subdocPath}".`
        );
      }
      arr[foundIndex] = { ...arr[foundIndex], ...update };
    }
  }
}


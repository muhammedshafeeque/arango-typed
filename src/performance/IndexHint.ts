import { Database } from 'arangojs';

export class IndexHint {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Add index hint to AQL query
   */
  static addHint(query: string, collectionName: string, indexName: string): string {
    if (!query || typeof query !== 'string') {
      throw new Error('Invalid query: query must be a non-empty string');
    }

    if (!collectionName || typeof collectionName !== 'string') {
      throw new Error('Invalid collection name');
    }

    if (!indexName || typeof indexName !== 'string') {
      throw new Error('Invalid index name');
    }

    const useIndexHint = `USE INDEX ${indexName}`;
    
    // Escape collection name for regex (in case it has special characters)
    const escapedCollection = collectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Pattern to match FOR clauses - handle both @collection and direct collection names
    // Matches: FOR var IN collection or FOR var IN @@collection
    const forPattern = new RegExp(
      `(FOR\\s+\\w+\\s+IN\\s+(?:@)?${escapedCollection})(?=\\s|\\n|$)`,
      'gi'
    );

    // Find all matches to validate
    const matches = query.match(forPattern);
    
    if (!matches || matches.length === 0) {
      throw new Error(
        `No FOR clause found for collection "${collectionName}" in query. ` +
        `Make sure the collection name matches exactly (including @ prefix if used).`
      );
    }

    // Handle multiple FOR clauses - add hint to first matching one
    // In case of multiple, user should call this method multiple times with different collection names
    const firstMatch = matches[0];
    const firstMatchIndex = query.search(forPattern);
    
    // Check if hint already exists for this collection
    const hintPattern = new RegExp(
      `FOR\\s+\\w+\\s+IN\\s+(?:@)?${escapedCollection}\\s+${useIndexHint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
      'i'
    );
    
    if (hintPattern.test(query)) {
      // Hint already exists
      return query;
    }

    // Insert hint after the FOR clause
    // Find position after the matched FOR clause
    const afterMatch = query.substring(firstMatchIndex + firstMatch.length);
    const whitespaceMatch = afterMatch.match(/^\s+/);
    const whitespace = whitespaceMatch ? whitespaceMatch[0] : ' ';
    
    const beforeMatch = query.substring(0, firstMatchIndex + firstMatch.length);
    const afterInsertion = afterMatch.substring(whitespace.length);
    
    return `${beforeMatch} ${useIndexHint}${whitespace}${afterInsertion}`;
  }

  /**
   * Get available indexes for collection
   */
  async getIndexes(collectionName: string): Promise<any[]> {
    const collection = this.database.collection(collectionName);
    return await collection.indexes();
  }

  /**
   * Find best index for query
   */
  async findBestIndex(collectionName: string, filterFields: string[]): Promise<string | null> {
    const indexes = await this.getIndexes(collectionName);
    
    // Find index that matches most filter fields
    let bestIndex: any = null;
    let bestMatch = 0;

    for (const index of indexes) {
      const indexFields = index.fields || [];
      const matchCount = filterFields.filter((field) => 
        indexFields.some((idxField: string) => idxField === field)
      ).length;

      if (matchCount > bestMatch) {
        bestMatch = matchCount;
        bestIndex = index;
      }
    }

    return bestIndex ? bestIndex.name || bestIndex.id : null;
  }
}



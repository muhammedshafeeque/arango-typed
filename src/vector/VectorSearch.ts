import { Database } from 'arangojs';
import { VectorSearchError } from '../errors/ArangoError';
import { CacheManager } from '../cache/CacheManager';

export interface VectorSearchOptions {
  limit?: number;
  threshold?: number;
  distance?: 'cosine' | 'euclidean' | 'dot';
  filter?: Record<string, any>;
  usePrecomputedMagnitudes?: boolean;
  cache?: CacheManager;
}

export interface EmbeddingOptions {
  field?: string;
  dimensions?: number;
}

export class VectorSearch {
  private database: Database;
  private defaultVectorField: string = 'embedding';

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Compute the magnitude (L2 norm) of a vector
   */
  static computeMagnitude(vector: number[]): number {
    if (!vector || vector.length === 0) {
      throw new VectorSearchError('Vector cannot be empty');
    }
    return Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  }

  /**
   * Create a vector index for similarity search
   */
  async createVectorIndex(
    collectionName: string,
    field: string,
    _options: EmbeddingOptions = {}
  ): Promise<void> {
    const collection = this.database.collection(collectionName);

    try {
      await collection.ensureIndex({
        type: 'inverted',
        fields: [field],
        analyzer: 'identity', // For vector similarity
      });

      // Note: ArangoDB doesn't have native vector indexes yet
      // This is a placeholder for when they add it, or we use custom AQL
      // For now, we'll use AQL with similarity functions
    } catch (error: any) {
      throw new VectorSearchError(`Failed to create vector index: ${error.message}`);
    }
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async similaritySearch(
    collectionName: string,
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<any[]> {
    // Validate input
    if (!queryVector || queryVector.length === 0) {
      throw new VectorSearchError('Query vector cannot be empty');
    }

    const {
      limit = 10,
      threshold = 0.0,
      filter = {},
      usePrecomputedMagnitudes = true,
      cache,
    } = options;

    const vectorField = this.defaultVectorField;

    // Check cache first
    if (cache) {
      const cacheKey = `vector_search:${collectionName}:${JSON.stringify(queryVector)}:${JSON.stringify(options)}`;
      const cached = await cache.get<any[]>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Pre-compute query vector magnitude once
    const queryMagnitude = VectorSearch.computeMagnitude(queryVector);

    // Build filter conditions
    const filterConditions: string[] = [];
    const bindVars: Record<string, any> = {
      queryVector,
      queryMagnitude,
      threshold,
      limit: limit,
    };

    for (const [key, value] of Object.entries(filter)) {
      const varName = `filter_${key}`;
      bindVars[varName] = value;
      filterConditions.push(`doc.${key} == @${varName}`);
    }

    // Optimized cosine similarity calculation using pre-computed magnitudes
    // cosine_similarity = dot(a, b) / (||a|| * ||b||)
    let query = `
      FOR doc IN @@collection
    `;

    if (filterConditions.length > 0) {
      query += `\n      FILTER ${filterConditions.join(' AND ')}`;
    }

    // Use pre-computed magnitude if available, otherwise compute in AQL
    if (usePrecomputedMagnitudes) {
      query += `
      LET similarity = (
        LET dot = SUM(
          FOR i IN 0..LENGTH(@queryVector) - 1
          RETURN doc.${vectorField}[i] * @queryVector[i]
        )
        LET docMagnitude = doc._vectorMagnitude != null ? doc._vectorMagnitude : SQRT(SUM(
          FOR v IN doc.${vectorField}
          RETURN v * v
        ))
        RETURN dot / (docMagnitude * @queryMagnitude)
      )
      FILTER similarity >= @threshold
      SORT similarity DESC
      LIMIT @limit
      RETURN MERGE(doc, { _similarity: similarity })
    `;
    } else {
      // Fallback to computing everything in AQL (backward compatible)
      query += `
      LET similarity = (
        LET dot = SUM(
          FOR i IN 0..LENGTH(@queryVector) - 1
          RETURN doc.${vectorField}[i] * @queryVector[i]
        )
        LET magnitudeA = SQRT(SUM(
          FOR v IN doc.${vectorField}
          RETURN v * v
        ))
        RETURN dot / (magnitudeA * @queryMagnitude)
      )
      FILTER similarity >= @threshold
      SORT similarity DESC
      LIMIT @limit
      RETURN MERGE(doc, { _similarity: similarity })
    `;
    }

    bindVars['@collection'] = collectionName;

    try {
      const cursor = await this.database.query(query, bindVars);
      const results = await cursor.all();
      
      // Cache results if cache is provided
      if (cache) {
        const cacheKey = `vector_search:${collectionName}:${JSON.stringify(queryVector)}:${JSON.stringify(options)}`;
        await cache.set(cacheKey, results, 300000); // 5 minutes TTL
      }
      
      return results;
    } catch (error: any) {
      throw new VectorSearchError(
        `Vector search failed: ${error.message}`,
        query
      );
    }
  }

  /**
   * Search with Euclidean distance
   */
  async euclideanSearch(
    collectionName: string,
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<any[]> {
    const {
      limit = 10,
      threshold = Infinity,
      filter = {},
    } = options;

    const vectorField = 'embedding';
    const filterConditions: string[] = [];
    const bindVars: Record<string, any> = {
      queryVector,
      threshold,
      limit: limit,
    };

    for (const [key, value] of Object.entries(filter)) {
      const varName = `filter_${key}`;
      bindVars[varName] = value;
      filterConditions.push(`doc.${key} == @${varName}`);
    }

    let query = `
      FOR doc IN @@collection
    `;

    if (filterConditions.length > 0) {
      query += `\n      FILTER ${filterConditions.join(' AND ')}`;
    }

    query += `
      LET distance = SQRT(SUM(
        FOR i IN 0..LENGTH(@queryVector) - 1
        RETURN POW(doc.${vectorField}[i] - @queryVector[i], 2)
      ))
      FILTER distance <= @threshold
      SORT distance ASC
      LIMIT @limit
      RETURN MERGE(doc, { _distance: distance })
    `;

    bindVars['@collection'] = collectionName;

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new VectorSearchError(
        `Euclidean search failed: ${error.message}`,
        query
      );
    }
  }

  /**
   * Hybrid search combining vector similarity and keyword search
   */
  async hybridSearch(
    collectionName: string,
    queryVector: number[],
    keywords: string,
    options: VectorSearchOptions & { keywordWeight?: number; vectorWeight?: number } = {}
  ): Promise<any[]> {
    const {
      limit = 10,
      threshold = 0.0,
      filter = {},
      keywordWeight = 0.5,
      vectorWeight = 0.5,
    } = options;

    const vectorField = 'embedding';

    const filterConditions: string[] = [];
    const bindVars: Record<string, any> = {
      queryVector,
      keywords,
      threshold,
      limit: limit,
      keywordWeight,
      vectorWeight,
    };

    for (const [key, value] of Object.entries(filter)) {
      const varName = `filter_${key}`;
      bindVars[varName] = value;
      filterConditions.push(`doc.${key} == @${varName}`);
    }

    let query = `
      FOR doc IN @@collection
    `;

    if (filterConditions.length > 0) {
      query += `\n      FILTER ${filterConditions.join(' AND ')}`;
    }

    query += `
      LET vectorScore = (
        LET dot = SUM(
          FOR i IN 0..LENGTH(@queryVector) - 1
          RETURN doc.${vectorField}[i] * @queryVector[i]
        )
        LET magnitudeA = SQRT(SUM(
          FOR v IN doc.${vectorField}
          RETURN v * v
        ))
        LET magnitudeB = SQRT(SUM(
          FOR v IN @queryVector
          RETURN v * v
        ))
        RETURN dot / (magnitudeA * magnitudeB)
      )
      LET keywordScore = BM25(doc, @keywords)
      LET combinedScore = (@vectorWeight * vectorScore) + (@keywordWeight * keywordScore)
      FILTER combinedScore >= @threshold
      SORT combinedScore DESC
      LIMIT @limit
      RETURN MERGE(doc, { _score: combinedScore, _vectorScore: vectorScore, _keywordScore: keywordScore })
    `;

    bindVars['@collection'] = collectionName;

    try {
      const cursor = await this.database.query(query, bindVars);
      return await cursor.all();
    } catch (error: any) {
      throw new VectorSearchError(
        `Hybrid search failed: ${error.message}`,
        query
      );
    }
  }

  /**
   * Ensure all documents in a collection have pre-computed vector magnitudes
   * This significantly improves vector search performance
   */
  async ensureMagnitudes(
    collectionName: string,
    vectorField: string = 'embedding',
    magnitudeField: string = '_vectorMagnitude'
  ): Promise<void> {
    if (!vectorField) {
      vectorField = this.defaultVectorField;
    }

    const query = `
      FOR doc IN @@collection
      FILTER doc.${vectorField} != null
      FILTER doc.${magnitudeField} == null
      LET magnitude = SQRT(SUM(
        FOR v IN doc.${vectorField}
        RETURN v * v
      ))
      UPDATE doc WITH { ${magnitudeField}: magnitude } IN @@collection
      RETURN NEW
    `;

    const bindVars = {
      '@collection': collectionName,
    };

    try {
      await this.database.query(query, bindVars);
    } catch (error: any) {
      throw new VectorSearchError(
        `Failed to compute vector magnitudes: ${error.message}`,
        query
      );
    }
  }
}


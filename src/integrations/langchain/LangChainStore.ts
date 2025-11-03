import { VectorSearch } from '../../vector/VectorSearch';
import { Database } from 'arangojs';
import { Model } from '../../model/Model';

export interface LangChainStoreOptions {
  collectionName: string;
  vectorField?: string;
  textField?: string;
  metadataFields?: string[];
}

// Type definitions for LangChain compatibility (types are optional peer dependencies)
export interface LangChainDocument {
  pageContent: string;
  metadata: Record<string, any>;
}

export interface LangChainEmbeddings {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

/**
 * LangChain VectorStore implementation using ArangoDB
 * Compatible with @langchain/core/vectorstores interface
 */
export class ArangoLangChainStore {
  public embeddings: LangChainEmbeddings;
  public vectorSearch: VectorSearch;
  private database: Database;
  private options: Required<LangChainStoreOptions>;
  private model?: Model<any>;

  constructor(
    embeddings: LangChainEmbeddings,
    dbConfig: { database: Database; collectionName: string; model?: Model<any> },
    options: Partial<LangChainStoreOptions> = {}
  ) {
    this.embeddings = embeddings;
    this.database = dbConfig.database;
    this.vectorSearch = new VectorSearch(dbConfig.database);
    this.model = dbConfig.model;
    this.options = {
      collectionName: dbConfig.collectionName,
      vectorField: options.vectorField || 'embedding',
      textField: options.textField || 'text',
      metadataFields: options.metadataFields || [],
    };
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(documents: LangChainDocument[]): Promise<string[]> {
    const texts = documents.map((doc) => doc.pageContent);
    
    // Generate embeddings
    const embeddings = await this.embeddings.embedDocuments(texts);

    // Prepare documents for storage
    const docsToStore = documents.map((doc, i) => ({
      [this.options.textField]: doc.pageContent,
      [this.options.vectorField]: embeddings[i],
      ...doc.metadata,
    }));

    // Store documents
    if (this.model) {
      await this.model.create(docsToStore);
    } else {
      const collection = this.database.collection(this.options.collectionName);
      await collection.import(docsToStore);
    }

    // Return IDs (would need to fetch after insert in real implementation)
    return documents.map((_, i) => `doc_${i}`);
  }

  /**
   * Add vectors directly
   */
  async addVectors(vectors: number[][], documents: LangChainDocument[]): Promise<string[]> {
    const docsToStore = documents.map((doc, i) => ({
      [this.options.textField]: doc.pageContent,
      [this.options.vectorField]: vectors[i],
      ...doc.metadata,
    }));

    if (this.model) {
      await this.model.create(docsToStore);
    } else {
      const collection = this.database.collection(this.options.collectionName);
      await collection.import(docsToStore);
    }

    return documents.map((_, i) => `doc_${i}`);
  }

  /**
   * Similarity search
   */
  async similaritySearch(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<LangChainDocument[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddings.embedQuery(query);

    // Perform vector search
    const results = await this.vectorSearch.similaritySearch(
      this.options.collectionName,
      queryEmbedding,
      {
        limit: k,
        filter: filter || {},
      }
    );

    // Convert to LangChain documents
    return results.map((result: any) => {
      const metadata: Record<string, any> = { ...result };
      delete metadata[this.options.textField];
      delete metadata[this.options.vectorField];
      delete metadata._id;
      delete metadata._key;
      delete metadata._rev;

      return {
        pageContent: result[this.options.textField] || '',
        metadata,
      };
    });
  }

  /**
   * Similarity search with scores
   */
  async similaritySearchWithScore(
    query: string,
    k: number = 4,
    filter?: Record<string, any>
  ): Promise<[LangChainDocument, number][]> {
    const queryEmbedding = await this.embeddings.embedQuery(query);

    const results = await this.vectorSearch.similaritySearch(
      this.options.collectionName,
      queryEmbedding,
      {
        limit: k,
        filter: filter || {},
      }
    );

    return results.map((result: any) => {
      const metadata: Record<string, any> = { ...result };
      delete metadata[this.options.textField];
      delete metadata[this.options.vectorField];
      delete metadata._id;
      delete metadata._key;
      delete metadata._rev;
      delete metadata._score;

      const doc: LangChainDocument = {
        pageContent: result[this.options.textField] || '',
        metadata,
      };

      return [doc, result._score || 0];
    });
  }

  /**
   * Delete documents by IDs
   */
  async delete(ids?: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;

    const collection = this.database.collection(this.options.collectionName);
    
    for (const id of ids) {
      try {
        await collection.remove(id);
      } catch (error) {
        // Document might not exist, continue
      }
    }
  }

  /**
   * Create vector store from texts
   */
  static async fromTexts(
    texts: string[],
    metadatas: Record<string, any>[] | Record<string, any>,
    embeddings: LangChainEmbeddings,
    dbConfig: { database: Database; collectionName: string; model?: Model<any> },
    options: Partial<LangChainStoreOptions> = {}
  ): Promise<ArangoLangChainStore> {
    const store = new ArangoLangChainStore(embeddings, dbConfig, options);
    
    const documents: LangChainDocument[] = texts.map((text, i) => {
      const metadata = Array.isArray(metadatas) ? metadatas[i] : metadatas;
      return { pageContent: text, metadata: metadata || {} };
    });

    await store.addDocuments(documents);
    return store;
  }

  /**
   * Create vector store from documents
   */
  static async fromDocuments(
    documents: LangChainDocument[],
    embeddings: LangChainEmbeddings,
    dbConfig: { database: Database; collectionName: string; model?: Model<any> },
    options: Partial<LangChainStoreOptions> = {}
  ): Promise<ArangoLangChainStore> {
    const store = new ArangoLangChainStore(embeddings, dbConfig, options);
    await store.addDocuments(documents);
    return store;
  }
}

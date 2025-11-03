import { ArangoLangChainStore, LangChainDocument } from './LangChainStore';
import { VectorSearch } from '../../vector/VectorSearch';
import { Database } from 'arangojs';

export interface LangChainEmbeddings {
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
}

export interface RAGOptions {
  collectionName: string;
  vectorField?: string;
  textField?: string;
  topK?: number;
  scoreThreshold?: number;
  reranker?: (docs: LangChainDocument[]) => Promise<LangChainDocument[]>;
}

export interface BaseRetriever {
  getRelevantDocuments(query: string): Promise<LangChainDocument[]>;
}

/**
 * RAG (Retrieval Augmented Generation) implementation with ArangoDB
 */
export class ArangoRAG {
  private vectorStore: ArangoLangChainStore;
  private vectorSearch: VectorSearch;
  private options: Required<Omit<RAGOptions, 'reranker'>> & { reranker?: RAGOptions['reranker'] };

  constructor(
    embeddings: LangChainEmbeddings,
    database: Database,
    options: RAGOptions
  ) {
    this.options = {
      collectionName: options.collectionName,
      vectorField: options.vectorField || 'embedding',
      textField: options.textField || 'text',
      topK: options.topK || 5,
      scoreThreshold: options.scoreThreshold || 0.0,
      reranker: options.reranker,
    };

    this.vectorStore = new ArangoLangChainStore(
      embeddings,
      { database, collectionName: this.options.collectionName }
    );

    this.vectorSearch = new VectorSearch(database);
  }

  /**
   * Retrieve relevant documents for a query
   */
  async retrieve(
    query: string,
    filter?: Record<string, any>,
    topK?: number
  ): Promise<LangChainDocument[]> {
    const k = topK || this.options.topK;
    
    let docs = await this.vectorStore.similaritySearch(query, k, filter);

    // Apply score threshold
    const docsWithScore = await this.vectorStore.similaritySearchWithScore(query, k, filter);
    docs = docsWithScore
      .filter(([, score]) => score >= this.options.scoreThreshold)
      .map(([doc]) => doc);

    // Apply reranker if provided
    if (this.options.reranker) {
      docs = await this.options.reranker(docs);
    }

    return docs;
  }

  /**
   * Retrieve with metadata filtering
   */
  async retrieveWithMetadata(
    query: string,
    metadataFilter: Record<string, any>,
    topK?: number
  ): Promise<LangChainDocument[]> {
    return this.retrieve(query, metadataFilter, topK);
  }

  /**
   * Hybrid search (vector + keyword)
   */
  async hybridRetrieve(
    query: string,
    keywords: string,
    filter?: Record<string, any>,
    topK?: number
  ): Promise<LangChainDocument[]> {
    const queryEmbedding = await this.vectorStore.embeddings.embedQuery(query);
    const k = topK || this.options.topK;

    const results = await this.vectorSearch.hybridSearch(
      this.options.collectionName,
      queryEmbedding,
      keywords,
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

      return {
        pageContent: result[this.options.textField] || '',
        metadata: {
          ...metadata,
          _score: result._score,
          _vectorScore: result._vectorScore,
          _keywordScore: result._keywordScore,
        },
      };
    });
  }

  /**
   * Create retriever for LangChain chains
   */
  createRetriever(filter?: Record<string, any>): BaseRetriever {
    return new ArangoRetriever(this, filter);
  }
}

/**
 * LangChain Retriever implementation
 */
class ArangoRetriever implements BaseRetriever {
  private rag: ArangoRAG;
  private filter?: Record<string, any>;

  constructor(rag: ArangoRAG, filter?: Record<string, any>) {
    this.rag = rag;
    this.filter = filter;
  }

  async getRelevantDocuments(query: string): Promise<LangChainDocument[]> {
    return this.rag.retrieve(query, this.filter);
  }
}

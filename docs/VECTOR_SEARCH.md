# Vector Search

Arango Typed provides built-in support for vector similarity search and embeddings.

## Basic Vector Search

```typescript
import { VectorSearch } from 'arango-typed';

const vectorSearch = new VectorSearch(db);

// Store document with embedding
await vectorSearch.store('documents', {
  text: 'Hello world',
  embedding: [0.1, 0.2, 0.3, ...], // Vector of 1536 dimensions
  metadata: { source: 'web' }
});

// Similarity search
const results = await vectorSearch.similaritySearch(
  'documents',
  queryVector,
  {
    topK: 5,
    scoreThreshold: 0.7
  }
);
```

## LangChain Integration

### ArangoLangChainStore

```typescript
import { ArangoLangChainStore } from 'arango-typed/integrations/langchain';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings();

const vectorStore = new ArangoLangChainStore(embeddings, {
  database: db,
  collectionName: 'documents',
  model: DocumentModel
});

// Add documents
await vectorStore.addDocuments([
  { pageContent: 'Document 1', metadata: {} },
  { pageContent: 'Document 2', metadata: {} }
]);

// Similarity search
const results = await vectorStore.similaritySearch('query', 5);
```

### RAG (Retrieval Augmented Generation)

```typescript
import { ArangoRAG } from 'arango-typed/integrations/langchain';

const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 5,
  scoreThreshold: 0.7
});

// Retrieve relevant context
const context = await rag.retrieve('What is machine learning?');

// Hybrid retrieval (vector + keyword)
const hybridContext = await rag.hybridRetrieve(
  'What is machine learning?',
  ['machine learning', 'AI', 'neural networks']
);
```

## MCP (Model Context Protocol)

```typescript
import { ArangoMCP } from 'arango-typed/integrations/langchain';

const mcp = new ArangoMCP(db, 'knowledge_graph');

// Get context for LLM
const context = await mcp.getContext({
  query: 'Tell me about artificial intelligence',
  graphTraversal: true,
  embeddings: queryEmbedding
});

console.log(context.graphContext);
console.log(context.documents);
```

## Performance Optimization

### Pre-computed Vector Magnitudes

For better performance, especially with large datasets, you can pre-compute vector magnitudes and store them in documents:

```typescript
import { VectorSearch, CacheManager } from 'arango-typed';

const vectorSearch = new VectorSearch(db);
const cache = new CacheManager({ ttl: 300000 }); // 5 minutes

// Compute and store magnitudes for all documents
await vectorSearch.ensureMagnitudes('documents', 'embedding', '_vectorMagnitude');

// Now similarity search will use pre-computed magnitudes (much faster!)
const results = await vectorSearch.similaritySearch('documents', queryVector, {
  usePrecomputedMagnitudes: true, // default: true
  cache: cache, // optional: enable result caching
  limit: 10,
  threshold: 0.7
});
```

### Caching Vector Search Results

Enable caching to avoid re-computing similar queries:

```typescript
const cache = new CacheManager({ ttl: 300000, maxSize: 1000 });

const results = await vectorSearch.similaritySearch('documents', queryVector, {
  cache: cache,
  limit: 10
});

// Subsequent identical queries will return cached results
```

### Magnitude Computation Helper

Compute vector magnitude manually if needed:

```typescript
const magnitude = VectorSearch.computeMagnitude([0.1, 0.2, 0.3, ...]);
console.log(magnitude); // L2 norm of the vector
```

## Vector Index Management

```typescript
// Create vector index
await vectorSearch.createVectorIndex('documents', 'embedding', {
  dimensions: 1536
});
```

## Performance Tips

1. **Pre-compute Magnitudes**: Use `ensureMagnitudes()` to store vector magnitudes in documents for 2-5x faster similarity calculations.

2. **Enable Caching**: Add a `CacheManager` to `similaritySearch()` options to cache frequent queries.

3. **Set Appropriate Thresholds**: Use `threshold` to filter out low-similarity results early.

4. **Batch Operations**: When adding many documents, compute magnitudes after insertion using `ensureMagnitudes()`.

5. **Index Fields**: Ensure your filter fields are indexed for better performance.

### Example: Optimized Setup

```typescript
import { VectorSearch, CacheManager, connect } from 'arango-typed';

await connect({ /* config */ });
const db = getDatabase();

const vectorSearch = new VectorSearch(db);
const cache = new CacheManager({ ttl: 300000, maxSize: 1000 });

// 1. Add documents with embeddings
await DocumentModel.insertMany(documents);

// 2. Compute and store magnitudes (one-time operation)
await vectorSearch.ensureMagnitudes('documents', 'embedding');

// 3. Search with caching enabled
const results = await vectorSearch.similaritySearch('documents', queryVector, {
  usePrecomputedMagnitudes: true,
  cache: cache,
  limit: 10,
  threshold: 0.7
});
```


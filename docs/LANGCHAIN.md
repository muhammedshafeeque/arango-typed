# LangChain Integration

Arango Typed provides seamless integration with LangChain.js for RAG (Retrieval Augmented Generation) and MCP (Model Context Protocol).

## Installation

```bash
npm install arango-typed @langchain/core @langchain/openai
```

## Vector Store

### ArangoLangChainStore

Use ArangoDB as a vector store for LangChain:

```typescript
import { ArangoLangChainStore } from 'arango-typed/integrations/langchain';
import { OpenAIEmbeddings } from '@langchain/openai';

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY
});

const vectorStore = new ArangoLangChainStore(embeddings, {
  database: db,
  collectionName: 'documents',
  model: DocumentModel
});

// Add documents
await vectorStore.addDocuments([
  { pageContent: 'Document 1', metadata: { source: 'web' } },
  { pageContent: 'Document 2', metadata: { source: 'pdf' } }
]);

// Similarity search
const results = await vectorStore.similaritySearch('query', 5);

// Similarity search with metadata filter
const filtered = await vectorStore.similaritySearchWithScore(
  'query',
  5,
  { source: 'web' }
);
```

## RAG (Retrieval Augmented Generation)

### Basic RAG

```typescript
import { ArangoRAG } from 'arango-typed/integrations/langchain';

const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 5,
  scoreThreshold: 0.7
});

// Retrieve relevant context
const context = await rag.retrieve('What is machine learning?');

// Use with LLM
const response = await llm.generate([
  ...context,
  { role: 'user', content: 'What is machine learning?' }
]);
```

### Hybrid Retrieval

Combine vector search with keyword search:

```typescript
const hybridContext = await rag.hybridRetrieve(
  'What is machine learning?',
  ['machine learning', 'AI', 'neural networks']
);
```

### RAG with Re-ranking

```typescript
const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 10,
  reranker: rerankerModel // Optional reranker
});

const context = await rag.retrieve('query');
```

## MCP (Model Context Protocol)

Use graph context for LLM queries:

```typescript
import { ArangoMCP } from 'arango-typed/integrations/langchain';

const mcp = new ArangoMCP(db, 'knowledge_graph');

// Get context for LLM
const context = await mcp.getContext({
  query: 'Tell me about artificial intelligence',
  graphTraversal: true,
  embeddings: queryEmbedding,
  metadata: { domain: 'tech' }
});

console.log(context.graphContext);
console.log(context.documents);
console.log(context.entities);
```

## Complete RAG Example

```typescript
import { connect } from 'arango-typed';
import { ArangoRAG, ArangoMCP } from 'arango-typed/integrations/langchain';
import { ChatOpenAI } from '@langchain/openai';

await connect({ /* config */ });
const db = getDatabase();

// Set up RAG
const rag = new ArangoRAG(embeddings, db, {
  collectionName: 'documents',
  topK: 5
});

// Set up MCP
const mcp = new ArangoMCP(db, 'knowledge_graph');

// Chat with RAG
async function chat(query: string) {
  // Get relevant documents
  const docs = await rag.retrieve(query);
  
  // Get graph context
  const graphContext = await mcp.getContext({
    query,
    graphTraversal: true
  });
  
  // Combine contexts
  const context = [
    ...docs.map(d => d.pageContent),
    ...graphContext.graphContext
  ].join('\n\n');
  
  // Generate response with LLM
  const llm = new ChatOpenAI();
  const response = await llm.invoke([
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: `Context:\n${context}\n\nQuestion: ${query}` }
  ]);
  
  return response.content;
}
```

## Express Integration

See [Express Documentation](./EXPRESS.md) for complete Express.js + LangChain setup.


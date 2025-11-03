/**
 * Quick Start: One-file setup for Express + ArangoDB + LangChain RAG
 */

import { connect } from '../../connection/Connection';
import { setupCompleteIntegration } from './CompleteExample';

// Quick start function
export async function quickStart() {
  // 1. Connect to ArangoDB
  await connect({
    url: process.env.ARANGO_URL || 'http://localhost:8529',
    databaseName: process.env.ARANGO_DB || 'rag_app',
    auth: {
      username: process.env.ARANGO_USER || 'root',
      password: process.env.ARANGO_PASS || '',
    },
  });

  // 2. Create app with all integrations
  const app = await setupCompleteIntegration({
    openAIApiKey: process.env.OPENAI_API_KEY,
    graphName: 'knowledge_graph',
  });

  // 3. Start server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`
🚀 ArangoDB + Express + LangChain Server Started!

📡 Endpoints:
   Health:    http://localhost:${port}/api/arango/health
   Chat:      http://localhost:${port}/api/chat
   Documents: http://localhost:${port}/api/documents
   MCP:       http://localhost:${port}/api/mcp/query
   
   Models:    http://localhost:${port}/api/arango/models/:name
   Vector:    http://localhost:${port}/api/arango/vector/search
   RAG:       http://localhost:${port}/api/arango/rag/retrieve
    `);
  });

  return app;
}

// Usage:
// quickStart().catch(console.error);


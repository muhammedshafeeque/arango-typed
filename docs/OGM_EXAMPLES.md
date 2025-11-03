# OGM Examples

Real-world examples demonstrating the awesome OGM capabilities of Arango Typed.

## Social Network Graph

```typescript
import { connect, graphModel, Schema } from 'arango-typed';

await connect({ /* config */ });
const db = getDatabase();

// User schema
const userSchema = new Schema({
  name: String,
  email: String,
  active: Boolean
});

// Create graph model
const UserGraph = graphModel(db, 'social_network', 'users', userSchema);

// Create users
const alice = await UserGraph.create({ name: 'Alice', email: 'alice@example.com' });
const bob = await UserGraph.create({ name: 'Bob', email: 'bob@example.com' });
const charlie = await UserGraph.create({ name: 'Charlie', email: 'charlie@example.com' });

// Create friendships (OGM relationships)
await UserGraph.createRelationship(alice._id, bob._id, 'friends', {
  since: new Date(),
  weight: 1.0
});

await UserGraph.createRelationship(bob._id, charlie._id, 'friends', {
  since: new Date(),
  weight: 1.0
});

// Navigate graph (OGM style)
const aliceFriends = await UserGraph.getOutbound(alice._id, 'friends');
console.log(`Alice has ${aliceFriends.length} friends`);

// Get path between vertices
const path = await UserGraph.getPath(alice._id, charlie._id);
console.log(`Path: ${path.vertices.map(v => v.name).join(' -> ')}`);
```

## Knowledge Graph

```typescript
// Entity schema
const entitySchema = new Schema({
  name: String,
  type: String, // person, organization, concept
  description: String
});

const EntityGraph = graphModel(db, 'knowledge_graph', 'entities', entitySchema);

// Create entities
const ai = await EntityGraph.create({
  name: 'Artificial Intelligence',
  type: 'concept',
  description: 'Machine intelligence'
});

const ml = await EntityGraph.create({
  name: 'Machine Learning',
  type: 'concept',
  description: 'AI subset'
});

// Create relationships
await EntityGraph.createRelationship(ml._id, ai._id, 'related_to', {
  type: 'is_subset_of',
  strength: 0.9
});

// Get related concepts
const related = await EntityGraph.getOutbound(ai._id, 'related_to');
```

## Recommendation System

```typescript
const userSchema = new Schema({ name: String });
const itemSchema = new Schema({ title: String, category: String });

const UserGraph = graphModel(db, 'recommendations', 'users', userSchema);
const ItemGraph = graphModel(db, 'recommendations', 'items', itemSchema);

// User interacts with items
await UserGraph.createRelationship(userId, itemId, 'interacts', {
  type: 'viewed',
  timestamp: new Date(),
  weight: 1.0
});

// Find similar users (collaborative filtering)
async function findSimilarUsers(userId: string) {
  const userItems = await UserGraph.getOutbound(userId, 'interacts');
  const itemIds = userItems.map(item => item._id);
  
  // Find users who interacted with same items
  const similarUsers = await UserGraph.getInbound(itemIds[0], 'interacts', {
    filter: { _from: { $ne: userId } }
  });
  
  return similarUsers;
}
```

## Supply Chain Graph

```typescript
const productSchema = new Schema({
  name: String,
  sku: String
});

const ProductGraph = graphModel(db, 'supply_chain', 'products', productSchema);

// Create supply chain relationships
await ProductGraph.createRelationship(
  'products/component_a',
  'products/final_product',
  'supplies',
  {
    quantity: 10,
    leadTime: 7,
    cost: 100
  }
);

// Find all components for a product
const components = await ProductGraph.getInbound('products/final_product', 'supplies');

// Find all products using a component
const products = await ProductGraph.getOutbound('products/component_a', 'supplies');
```

## Fraud Detection Network

```typescript
const transactionSchema = new Schema({
  amount: Number,
  timestamp: Date,
  suspicious: Boolean
});

const TransactionGraph = graphModel(
  db,
  'fraud_network',
  'transactions',
  transactionSchema
);

// Link suspicious transactions
await TransactionGraph.createRelationship(
  transaction1._id,
  transaction2._id,
  'linked_to',
  {
    similarity: 0.95,
    reason: 'same_pattern'
  }
);

// Find fraud clusters
const suspicious = await TransactionGraph.find({ suspicious: true }).all();
for (const tx of suspicious) {
  const linked = await TransactionGraph.getConnected(tx._id, 'linked_to', {
    depth: 2
  });
  console.log(`Transaction ${tx._id} linked to ${linked.length} transactions`);
}
```

## Network Analysis

```typescript
// Analyze communication network
const UserGraph = graphModel(db, 'communication', 'users', userSchema);

// Get network metrics
const metrics = {
  // Degree centrality
  outDegree: await UserGraph.countRelationships(userId, 'outbound'),
  inDegree: await UserGraph.countRelationships(userId, 'inbound'),
  
  // Connected components
  directConnections: (await UserGraph.getOutbound(userId)).length,
  twoHopConnections: (await UserGraph.getConnected(userId, '*', { depth: 2 })).length
};

// Find influential users (high out-degree)
const allUsers = await UserGraph.find().all();
const influential = await Promise.all(
  allUsers.map(async (user) => ({
    user,
    degree: await UserGraph.countRelationships(user._id, 'outbound')
  }))
);

const topInfluencers = influential
  .sort((a, b) => b.degree - a.degree)
  .slice(0, 10);
```


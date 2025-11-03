# OGM (Object Graph Mapper) Guide

Arango Typed provides **awesome OGM (Object Graph Mapper)** capabilities, allowing you to work with graphs in an object-oriented way, similar to Neo4j OGM patterns.

## What is OGM?

OGM (Object Graph Mapper) is like ORM for graphs. It allows you to:
- Work with graph relationships as object properties
- Navigate graphs using intuitive methods
- Manage edges as relationships between objects
- Query graphs using familiar patterns

## Graph Models

### Creating a Graph Model

```typescript
import { graphModel, GraphModel } from 'arango-typed';
import { Schema } from 'arango-typed';

const userSchema = new Schema({
  name: String,
  email: String,
  active: Boolean
});

// Create a graph model
const UserGraph = graphModel(db, 'social_network', 'users', userSchema);
```

### Class-Based Graph Model

```typescript
import { GraphModel } from 'arango-typed';

class UserGraphModel extends GraphModel<UserDoc> {
  constructor(database: Database) {
    super(
      database,
      'social_network',  // Graph name
      'users',            // Collection name
      userSchema
    );
  }

  // Add custom methods
  async findMutualFriends(userId1: string, userId2: string) {
    const friends1 = await this.getOutbound(userId1, 'friends');
    const friends2 = await this.getOutbound(userId2, 'friends');
    
    // Find intersection
    const friendIds1 = new Set(friends1.map(f => f._id));
    return friends2.filter(f => friendIds1.has(f._id));
  }
}

const UserGraph = new UserGraphModel(db);
```

## Relationship Access

### Get Outbound Relationships

```typescript
// Get all friends (outbound relationships)
const friends = await UserGraph.getOutbound('users/alice', 'friends');

// Get with filter
const activeFriends = await UserGraph.getOutbound('users/alice', 'friends', {
  filter: { active: true },
  limit: 10
});
```

### Get Inbound Relationships

```typescript
// Get all followers (inbound relationships)
const followers = await UserGraph.getInbound('users/alice', 'follows');
```

### Get Connected Vertices

```typescript
// Get connected vertices in any direction
const connections = await UserGraph.getConnected('users/alice', 'friends', {
  direction: 'any',  // outbound, inbound, or any
  depth: 2,          // Traversal depth
  filter: { active: true },
  limit: 50
});
```

## Creating Relationships

### Create Relationship (Edge)

```typescript
// Create a relationship
await UserGraph.createRelationship(
  'users/alice',      // From vertex
  'users/bob',        // To vertex
  'friends',          // Edge collection
  {                   // Edge properties
    since: new Date(),
    weight: 1.0,
    metadata: {
      source: 'recommendation',
      mutualFriends: 5
    }
  }
);
```

### Delete Relationship

```typescript
// Delete a specific relationship
await UserGraph.deleteRelationship('friends', {
  _from: 'users/alice',
  _to: 'users/bob'
});

// Delete multiple relationships
await UserGraph.deleteRelationship('friends', {
  _from: 'users/alice'
});
```

## Path Queries

### Shortest Path

```typescript
const path = await UserGraph.getPath(
  'users/alice',
  'users/charlie',
  {
    maxDepth: 5,
    direction: 'any',
    edgeFilter: 'edge.weight > 0.5'
  }
);

console.log(`Path length: ${path.vertices.length}`);
console.log(`Vertices: ${path.vertices.map(v => v.name).join(' -> ')}`);
```

### Count Relationships

```typescript
// Count outbound relationships
const friendCount = await UserGraph.countRelationships(
  'users/alice',
  'outbound'
);

// Count inbound relationships
const followerCount = await UserGraph.countRelationships(
  'users/alice',
  'inbound'
);

// Count all relationships
const totalConnections = await UserGraph.countRelationships(
  'users/alice',
  'any'
);
```

## Complete OGM Example

### Social Network Graph

```typescript
import { connect, graphModel, Schema } from 'arango-typed';

// Connect
await connect({ /* config */ });
const db = getDatabase();

// Define schemas
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

// Create relationships
await UserGraph.createRelationship(alice._id, bob._id, 'friends', {
  since: new Date(),
  weight: 1.0
});

await UserGraph.createRelationship(bob._id, charlie._id, 'friends', {
  since: new Date(),
  weight: 1.0
});

// Navigate graph
const aliceFriends = await UserGraph.getOutbound(alice._id, 'friends');
console.log(`Alice has ${aliceFriends.length} friends`);

// Get path
const path = await UserGraph.getPath(alice._id, charlie._id);
console.log(`Path from Alice to Charlie: ${path.vertices.length} steps`);
```

## Advanced OGM Patterns

### Graph Traversals

```typescript
import { Graph } from 'arango-typed';

const graph = new Graph(db, 'social_network');

// Traverse graph
const result = await graph.traverse({
  startVertex: 'users/alice',
  direction: 'outbound',
  minDepth: 1,
  maxDepth: 3,
  filter: 'vertex.active == true'
});

result.vertices.forEach(vertex => {
  console.log(vertex.name);
});
```

### Graph Algorithms

```typescript
import { GraphAlgorithms } from 'arango-typed';

const algorithms = new GraphAlgorithms(db, 'social_network');

// PageRank - Find influential users
const pageRank = await algorithms.pageRank();
const influentialUsers = pageRank
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

// Centrality - Find well-connected users
const centrality = await algorithms.degreeCentrality();
const wellConnected = centrality
  .sort((a, b) => b.degree - a.degree)
  .slice(0, 10);

// Community Detection - Find user groups
const communities = await algorithms.communityDetection();
```

## Best Practices

### 1. Use Graph Models for Graph Operations

```typescript
// ✅ Good: Use GraphModel for graph-specific operations
const friends = await UserGraph.getOutbound(userId, 'friends');

// ❌ Avoid: Using regular Model for graph operations
const friends = await User.find({ _id: { $in: friendIds } });
```

### 2. Index Edge Collections

```typescript
// Create indexes on edge collections for performance
await db.collection('friends').ensureIndex({
  type: 'persistent',
  fields: ['_from', '_to']
});
```

### 3. Use Filters Efficiently

```typescript
// ✅ Good: Filter at graph level
const activeFriends = await UserGraph.getOutbound(userId, 'friends', {
  filter: { active: true }
});

// ❌ Avoid: Filtering after retrieval
const allFriends = await UserGraph.getOutbound(userId, 'friends');
const activeFriends = allFriends.filter(f => f.active);
```

## OGM vs Regular Models

| Feature | Regular Model | Graph Model (OGM) |
|---------|--------------|-------------------|
| Use Case | Document operations | Graph relationships |
| Relationships | Populate relations | Native graph access |
| Queries | Document queries | Graph traversals |
| Performance | Fast for documents | Optimized for graphs |
| Complexity | Simple CRUD | Graph patterns |

## Use Cases

- **Social Networks** - Friends, follows, connections
- **Recommendation Systems** - User-item relationships
- **Knowledge Graphs** - Entity relationships
- **Supply Chains** - Product flows
- **Fraud Detection** - Transaction networks
- **Network Analysis** - Communication patterns

## More Examples

See [OGM Examples](./OGM_EXAMPLES.md) for real-world use cases:
- Social networks
- Knowledge graphs
- Recommendation systems
- Supply chains
- Fraud detection networks
- Network analysis

---

**Next Steps:**
- Check [Graph Documentation](./GRAPH.md) for advanced graph features
- See [OGM Examples](./OGM_EXAMPLES.md) for complete examples
- See [Relations Documentation](./RELATIONS.md) for document relationships
- Explore [Examples](../src/integrations/examples/) for framework integration examples


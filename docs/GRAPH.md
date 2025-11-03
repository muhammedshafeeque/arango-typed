# OGM (Object Graph Mapper)

Arango Typed provides **awesome OGM (Object Graph Mapper)** support, making it easy to work with graph databases in an object-oriented way, similar to Neo4j OGM patterns.

## Graph Models (OGM Pattern)

### Creating Graph Models

The OGM pattern provides a model-like interface for graph vertices:

```typescript
import { graphModel, GraphModel } from 'arango-typed';

// Create a graph model
const UserGraph = graphModel(db, 'social_network', 'users', userSchema);

// Or using class
class UserGraphModel extends GraphModel<UserDoc> {
  constructor(db: Database) {
    super(db, 'social_network', 'users', userSchema);
  }
}

const UserGraph = new UserGraphModel(db);
```

### OGM Relationship Access

```typescript
// Get outbound relationships (like user.friends in Neo4j OGM)
const friends = await UserGraph.getOutbound('users/alice', 'friends');

// Get inbound relationships
const followers = await UserGraph.getInbound('users/alice', 'follows');

// Get connected vertices with filters
const activeFriends = await UserGraph.getConnected('users/alice', 'friends', {
  direction: 'outbound',
  filter: { active: true },
  limit: 10
});

// Count relationships
const friendCount = await UserGraph.countRelationships('users/alice', 'outbound');
```

### Creating Relationships (Edges)

```typescript
// Create relationship between vertices
await UserGraph.createRelationship(
  'users/alice',
  'users/bob',
  'friends',
  {
    since: new Date(),
    weight: 1.0,
    metadata: { source: 'recommendation' }
  }
);

// Delete relationship
await UserGraph.deleteRelationship('friends', {
  _from: 'users/alice',
  _to: 'users/bob'
});
```

### Path Queries (OGM Style)

```typescript
// Get path between two vertices
const path = await UserGraph.getPath('users/alice', 'users/charlie', {
  maxDepth: 5,
  direction: 'any'
});

console.log(path.vertices); // Array of vertices in path
console.log(path.edges);     // Array of edges in path
```

## Creating Graphs

```typescript
import { Graph } from 'arango-typed';

// Create a graph
const graph = await Graph.create('social_network', {
  edgeDefinitions: [
    {
      collection: 'friends',
      from: ['users'],
      to: ['users']
    },
    {
      collection: 'follows',
      from: ['users'],
      to: ['users']
    }
  ]
});
```

## Working with Edges

### Create Edges

```typescript
import { Edge } from 'arango-typed';

// Create an edge
const edge = await Edge.create('friends', {
  _from: 'users/alice',
  _to: 'users/bob',
  since: new Date(),
  weight: 1.0
});
```

### Find Edges

```typescript
// Find edges from a vertex
const edges = await Edge.find('friends', {
  _from: 'users/alice'
}).all();

// Find edges to a vertex
const edges = await Edge.find('friends', {
  _to: 'users/bob'
}).all();
```

## Graph Traversals

### Basic Traversal

```typescript
const graph = new Graph(db, 'social_network');

const result = await graph.traverse({
  startVertex: 'users/alice',
  direction: 'outbound',
  depth: 2
});

result.vertices.forEach(vertex => {
  console.log(vertex._id);
});
```

### Traversal with Filters

```typescript
const result = await graph.traverse({
  startVertex: 'users/alice',
  direction: 'outbound',
  minDepth: 1,
  maxDepth: 3,
  edgeFilter: 'edge.weight > 0.5',
  vertexFilter: 'vertex.active == true'
});
```

## Shortest Path

```typescript
const path = await graph.shortestPath(
  'users/alice',
  'users/charlie'
);

console.log(path.vertices); // Array of vertices in path
console.log(path.edges);   // Array of edges in path
```

## Graph Algorithms

```typescript
import { GraphAlgorithms } from 'arango-typed';

const algorithms = new GraphAlgorithms(db, 'social_network');

// PageRank
const pageRank = await algorithms.pageRank();

// Centrality
const centrality = await algorithms.degreeCentrality();

// Community Detection
const communities = await algorithms.communityDetection();
```

## Path Queries

```typescript
import { PathQueries } from 'arango-typed';

const paths = new PathQueries(db, 'social_network');

// Find all paths between two vertices
const allPaths = await paths.findAllPaths(
  'users/alice',
  'users/charlie',
  { maxDepth: 3 }
);

// Find k shortest paths
const kShortest = await paths.kShortestPaths(
  'users/alice',
  'users/charlie',
  { k: 5 }
);
```

## Graph Statistics

```typescript
const stats = await graph.getStatistics();
console.log(stats.vertices);
console.log(stats.edges);
console.log(stats.numberOfVertices);
```

## Pattern Matching

```typescript
// Find patterns in graph
const patterns = await graph.matchPattern({
  vertices: [
    { collection: 'users', filter: 'user.active == true' },
    { collection: 'posts', filter: 'post.published == true' }
  ],
  edges: [
    { collection: 'writes', from: 0, to: 1 }
  ]
});
```


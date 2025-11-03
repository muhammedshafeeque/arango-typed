import { Database } from 'arangojs';

export interface EdgeDefinition {
  collection: string;
  from: string[];
  to: string[];
}

export interface GraphOptions {
  edgeDefinitions?: EdgeDefinition[];
  orphanCollections?: string[];
  isSmart?: boolean;
  smartGraphAttribute?: string;
  numberOfShards?: number;
  replicationFactor?: number;
}

export class GraphManager {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Create a graph
   */
  async create(graphName: string, options: GraphOptions = {}): Promise<any> {
    const graph = this.database.graph(graphName);
    
    const createOptions: any = {};
    if (options.edgeDefinitions && options.edgeDefinitions.length > 0) {
      createOptions.edgeDefinitions = options.edgeDefinitions.map((ed) => ({
        collection: ed.collection,
        from: ed.from,
        to: ed.to,
      }));
    }
    if (options.orphanCollections) {
      createOptions.orphanCollections = options.orphanCollections;
    }
    if (options.isSmart !== undefined) {
      createOptions.isSmart = options.isSmart;
    }
    if (options.smartGraphAttribute) {
      createOptions.smartGraphAttribute = options.smartGraphAttribute;
    }
    if (options.numberOfShards) {
      createOptions.numberOfShards = options.numberOfShards;
    }
    if (options.replicationFactor) {
      createOptions.replicationFactor = options.replicationFactor;
    }

    await graph.create(createOptions);

    return graph;
  }

  /**
   * Get a graph instance
   */
  getGraph(graphName: string): any {
    return this.database.graph(graphName);
  }

  /**
   * Check if graph exists
   */
  async exists(graphName: string): Promise<boolean> {
    const graph = this.database.graph(graphName);
    return graph.exists();
  }

  /**
   * List all graphs
   */
  async list(): Promise<string[]> {
    const graphs = await this.database.listGraphs();
    return graphs.map((g: any) => g.name);
  }

  /**
   * Drop a graph
   */
  async drop(graphName: string): Promise<void> {
    const graph = this.database.graph(graphName);
    await graph.drop();
  }

  /**
   * Add edge definition to graph
   */
  async addEdgeDefinition(
    graphName: string,
    edgeDefinition: EdgeDefinition
  ): Promise<void> {
    const graph = this.database.graph(graphName);
    await graph.addEdgeDefinition(edgeDefinition);
  }

  /**
   * Remove edge definition from graph
   */
  async removeEdgeDefinition(
    graphName: string,
    collection: string
  ): Promise<void> {
    const graph = this.database.graph(graphName);
    await graph.removeEdgeDefinition(collection);
  }
}


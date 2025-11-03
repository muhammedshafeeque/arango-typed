import { Database } from 'arangojs';

export interface QueryPlan {
  nodes: any[];
  estimatedCost: number;
  estimatedNrItems: number;
}

export interface OptimizationSuggestion {
  type: 'index' | 'query' | 'structure';
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export class Optimizer {
  private database: Database;

  constructor(database: Database) {
    this.database = database;
  }

  /**
   * Analyze query execution plan
   */
  async analyzeQuery(query: string, bindVars?: Record<string, any>): Promise<QueryPlan> {
    // Explain query to get execution plan
    const cursor = await this.database.query(query, bindVars);
    const _plan = (cursor as any).plan || {};
    
    return {
      nodes: _plan.nodes || [],
      estimatedCost: _plan.estimatedCost || 0,
      estimatedNrItems: _plan.estimatedNrItems || 0,
    };
  }

  /**
   * Get optimization suggestions
   */
  async getSuggestions(query: string, bindVars?: Record<string, any>): Promise<OptimizationSuggestion[]> {
    const plan = await this.analyzeQuery(query, bindVars);
    const suggestions: OptimizationSuggestion[] = [];

    // Check for full collection scans
    const hasFullScan = plan.nodes.some((node: any) => 
      node.type === 'EnumerateCollectionNode' && !node.index
    );

    if (hasFullScan) {
      suggestions.push({
        type: 'index',
        message: 'Query performs full collection scan. Consider adding an index.',
        severity: 'high',
      });
    }

    // Check estimated cost
    if (plan.estimatedCost > 10000) {
      suggestions.push({
        type: 'query',
        message: `High estimated cost (${plan.estimatedCost}). Consider optimizing query structure.`,
        severity: 'medium',
      });
    }

    // Check estimated number of items
    if (plan.estimatedNrItems > 100000) {
      suggestions.push({
        type: 'query',
        message: `Query may process many items (${plan.estimatedNrItems}). Consider adding filters.`,
        severity: 'medium',
      });
    }

    return suggestions;
  }

  /**
   * Suggest indexes for collection
   */
  async suggestIndexes(collectionName: string, sampleQueries: string[]): Promise<OptimizationSuggestion[]> {
    const suggestions: OptimizationSuggestion[] = [];
    const indexHints = new Map<string, string[]>();

    // Analyze each query to find common filter patterns
    for (const query of sampleQueries) {
      await this.analyzeQuery(query);
      
      // Extract filter fields (simplified)
      // In production, you'd parse AQL more thoroughly
      const filterMatches = query.match(/FILTER\s+doc\.(\w+)/g);
      if (filterMatches) {
        filterMatches.forEach((match) => {
          const field = match.replace(/FILTER\s+doc\./, '');
          const current = indexHints.get(collectionName) || [];
          if (!current.includes(field)) {
            indexHints.set(collectionName, [...current, field]);
          }
        });
      }
    }

    // Generate suggestions
    const suggestedFields = indexHints.get(collectionName);
    if (suggestedFields && suggestedFields.length > 0) {
      suggestions.push({
        type: 'index',
        message: `Consider adding index on: ${suggestedFields.join(', ')}`,
        severity: 'medium',
      });
    }

    return suggestions;
  }
}


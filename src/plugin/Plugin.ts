import { Schema } from '../schema/Schema';

export type PluginFunction = (schema: Schema, options?: any) => void;

export interface Plugin {
  (schema: Schema, options?: any): void;
}

export class PluginRegistry {
  private static plugins: Map<string, PluginFunction> = new Map();

  /**
   * Register a plugin
   */
  static register(name: string, plugin: PluginFunction): void {
    this.plugins.set(name, plugin);
  }

  /**
   * Apply plugin to schema
   */
  static apply(schema: Schema, pluginName: string, options?: any): void {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }
    plugin(schema, options);
  }

  /**
   * Apply multiple plugins
   */
  static applyAll(schema: Schema, plugins: Array<{ name: string; options?: any }>): void {
    for (const { name, options } of plugins) {
      this.apply(schema, name, options);
    }
  }

  /**
   * Create a plugin factory
   */
  static create(plugin: PluginFunction): Plugin {
    return (schema: Schema, options?: any) => {
      plugin(schema, options);
    };
  }
}

/**
 * Built-in plugins
 */
export const plugins = {
  /**
   * Timestamp plugin - adds createdAt and updatedAt fields
   */
  timestamps: PluginRegistry.create((schema: Schema) => {
    schema.paths.createdAt = {
      type: 'Date',
      default: () => new Date(),
    };
    schema.paths.updatedAt = {
      type: 'Date',
      default: () => new Date(),
    };

    schema.pre('save', async function(doc: any) {
      if (doc.isNewDoc()) {
        doc.createdAt = new Date();
      }
      doc.updatedAt = new Date();
    });
  }),

  /**
   * Soft delete plugin - adds deletedAt field and prevents hard deletes
   */
  softDelete: PluginRegistry.create((schema: Schema) => {
    schema.paths.deletedAt = {
      type: 'Date',
      default: null,
    };

    schema.pre('remove', async function(doc: any) {
      doc.deletedAt = new Date();
      await doc.save();
      throw new Error('Document soft deleted, use restore() to restore');
    });
  }),

  /**
   * Slug plugin - generates URL-friendly slugs
   */
  slug: PluginRegistry.create((schema: Schema, options: { field?: string; slugField?: string } = {}) => {
    const field = options.field || 'name';
    const slugField = options.slugField || 'slug';

    schema.paths[slugField] = {
      type: 'String',
      index: true,
    };

    schema.pre('save', async function(doc: any) {
      if (doc.isModified(field) || doc.isNewDoc()) {
        const value = doc[field];
        if (value) {
          doc[slugField] = value
            .toString()
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }
      }
    });
  }),
};


import { Schema } from '../schema/Schema';
import { SchemaDefinition } from '../types/schemas';
import { Model } from '../model/Model';
import { Database } from 'arangojs';

export interface DiscriminatorOptions {
  key?: string;
  value: string;
  database: Database;
  collectionName: string;
}

export class Discriminator {
  private baseSchema: Schema;
  private discriminatorKey: string;
  private database: Database;
  private collectionName: string;
  private discriminators: Map<string, { schema: Schema; model: Model<any> }> = new Map();

  constructor(baseSchema: Schema, options: DiscriminatorOptions) {
    this.baseSchema = baseSchema;
    this.discriminatorKey = options.key || '__type';
    this.database = options.database;
    this.collectionName = options.collectionName;
    
    // Add discriminator field to base schema
    if (!this.baseSchema.paths[this.discriminatorKey]) {
      this.baseSchema.paths[this.discriminatorKey] = {
        type: 'String',
        required: true,
        default: () => options.value,
      };
    }
  }

  /**
   * Create a discriminator model
   */
  discriminator<T>(
    name: string,
    schemaDefinition: SchemaDefinition,
    modelFactory: (schema: Schema, database: Database, collectionName: string) => Model<T>
  ): Model<T> {
    // Merge discriminator schema with base schema
    const baseDefinition = { ...this.baseSchema.paths };
    const discriminatorSchema = new Schema({
      ...baseDefinition,
      ...schemaDefinition,
    });

    // Set discriminator value
    discriminatorSchema.paths[this.discriminatorKey] = {
      type: 'String',
      required: true,
      default: () => name,
    };

    // Create model with merged schema
    const model = modelFactory(discriminatorSchema, this.database, this.collectionName);

    // Store discriminator
    this.discriminators.set(name, {
      schema: discriminatorSchema,
      model,
    });

    return model;
  }

  /**
   * Find discriminator model by value
   */
  findDiscriminator(value: string): Model<any> | null {
    const discriminator = this.discriminators.get(value);
    return discriminator ? discriminator.model : null;
  }

  /**
   * Get discriminator key
   */
  getDiscriminatorKey(): string {
    return this.discriminatorKey;
  }

  /**
   * Get all discriminators
   */
  getDiscriminators(): string[] {
    return Array.from(this.discriminators.keys());
  }
}


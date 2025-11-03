export type SchemaType = 
  | 'String'
  | 'Number'
  | 'Date'
  | 'Boolean'
  | 'Array'
  | 'Object'
  | 'Mixed'
  | 'Buffer';

export interface SchemaFieldDefinition {
  type: SchemaType | SchemaFieldDefinition | Array<SchemaType | SchemaFieldDefinition>;
  required?: boolean;
  default?: any;
  validate?: (value: any) => boolean | string | Promise<boolean | string>;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  enum?: any[];
  match?: RegExp;
  get?: (value: any) => any;
  set?: (value: any) => any;
  select?: boolean;
  sparse?: boolean;
  unique?: boolean;
  index?: boolean | 'text' | 'geo';
  ref?: string;
  of?: SchemaFieldDefinition;
}

export type SchemaDefinition = Record<string, SchemaFieldDefinition | SchemaType>;

export interface IndexDefinition {
  type: 'persistent' | 'ttl' | 'geo' | 'fulltext';
  fields: string[];
  unique?: boolean;
  sparse?: boolean;
  expireAfter?: number; // for TTL indexes
}

export interface VirtualFieldDefinition {
  get(): any;
  set?(value: any): void;
}


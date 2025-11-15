import { Database } from 'arangojs';

export interface ConnectionOptions {
  url: string | string[];
  databaseName?: string;
  auth?: {
    username: string;
    password: string;
  };
  agent?: any;
  arangoVersion?: number;
  autoCreateDatabase?: boolean;
}

export interface ModelOptions {
  collection?: string;
  connection?: Database;
  tenantEnabled?: boolean;
  tenantField?: string;
  softDeleteEnabled?: boolean;
}

export type HookType = 'save' | 'remove' | 'validate' | 'init';

export type HookCallback = (doc: any) => void | Promise<void>;

export interface ArangoDocument {
  _id?: string;
  _key?: string;
  _rev?: string;
  [key: string]: any;
}

export type ModelStatic<T = any> = {
  new (data?: Partial<T>): T & ArangoDocument;
  schema: any;
  collectionName: string;
  connection: Database;
  create(data: Partial<T> | Partial<T>[]): Promise<(T & ArangoDocument) | (T & ArangoDocument)[]>;
  find(query?: any): any;
  findOne(query?: any): Promise<(T & ArangoDocument) | null>;
  findById(id: string): Promise<(T & ArangoDocument) | null>;
  findOneAndUpdate(query: any, update: Partial<T>, options?: any): Promise<(T & ArangoDocument) | null>;
  findOneAndDelete(query: any): Promise<(T & ArangoDocument) | null>;
  deleteMany(query?: any): Promise<number>;
  count(query?: any): Promise<number>;
};


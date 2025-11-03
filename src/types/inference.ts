/**
 * Utility types for better TypeScript inference
 */

export type InferSchemaType<T> = T extends { type: infer U }
  ? U extends 'String'
    ? string
    : U extends 'Number'
    ? number
    : U extends 'Boolean'
    ? boolean
    : U extends 'Date'
    ? Date
    : U extends 'Array'
    ? T extends { of: infer O }
      ? Array<InferSchemaType<{ type: O }>>
      : any[]
    : U extends 'Object'
    ? Record<string, any>
    : U extends 'Mixed'
    ? any
    : any
  : any;

export type InferModelType<T extends Record<string, any>> = {
  [K in keyof T]: InferSchemaType<T[K]>;
};


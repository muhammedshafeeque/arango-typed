// Framework adapters
export { UniversalAdapter } from '../core/Adapter';
export type {
  FrameworkRequest,
  FrameworkResponse,
  FrameworkNext,
  FrameworkContext,
  AdapterOptions,
} from '../core/Adapter';

export { FastifyAdapter, createFastifyAdapter } from './FastifyAdapter';
export { KoaAdapter, createKoaAdapter } from './KoaAdapter';
export { NestJSAdapter, ArangoExceptionFilter, createNestJSAdapter } from './NestJSAdapter';
export { NextJSAdapter, createNextJSAdapter } from './NextJSAdapter';
export { HonoAdapter, createHonoAdapter } from './HonoAdapter';

export { UniversalRoutes } from './UniversalRoutes';
export type { UniversalRoutesOptions } from './UniversalRoutes';



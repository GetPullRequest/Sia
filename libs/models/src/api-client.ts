// Wrapper file that re-exports everything from the generated api-client
// This includes the client which is not exported by the generated index.ts
// This file should NOT be modified by code generation scripts

export type * from './generated/api-client/types.gen.js';
export * from './generated/api-client/sdk.gen.js';
export { client } from './generated/api-client/client.gen.js';


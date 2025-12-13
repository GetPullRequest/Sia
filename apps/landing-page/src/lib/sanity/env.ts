// Environment variables for Sanity configuration
// Use the define values from vite.config.ts
declare const __VITE_SANITY_API_VERSION__: string;
declare const __VITE_SANITY_DATASET__: string;
declare const __VITE_SANITY_PROJECT_ID__: string;

export const apiVersion = __VITE_SANITY_API_VERSION__;
export const dataset = __VITE_SANITY_DATASET__;
export const projectId = __VITE_SANITY_PROJECT_ID__;
export const useCdn = false;

// For Vite, use VITE_ prefix, but also support NEXT_PUBLIC_ for compatibility
export const apiVersion =
  import.meta.env.VITE_SANITY_API_VERSION || 
  '2024-01-22'

export const dataset = 
  import.meta.env.VITE_SANITY_DATASET || 
  'Missing environment variable: VITE_SANITY_DATASET or NEXT_PUBLIC_SANITY_DATASET'


export const projectId = 
  import.meta.env.VITE_SANITY_PROJECT_ID || 
  'Missing environment variable: VITE_SANITY_PROJECT_ID or NEXT_PUBLIC_SANITY_PROJECT_ID'


export const useCdn = false




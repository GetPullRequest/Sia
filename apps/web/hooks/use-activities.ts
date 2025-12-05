import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Hook to fetch all activities from the API with authentication
 */
export function useActivities() {
    return useQuery({
        queryKey: ['activities'],
        queryFn: async () => {
            return await api.getActivities()
        },
        // refetchInterval: 5000, // Refetch every 5 seconds for live updates
        staleTime: 1000, // Consider data stale after 1 second
    })
}

/**
 * Hook to fetch a single activity by ID with authentication
 */
export function useActivity(id: string) {
    return useQuery({
        queryKey: ['activity', id],
        queryFn: async () => {
            const activity = await api.getActivity(id)
            if (!activity) {
                throw new Error(`Activity with id ${id} not found`)
            }
            return activity
        },
        enabled: !!id, // Only run query if id is provided
    })
}

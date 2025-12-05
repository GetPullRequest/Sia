"use client"


import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { useActivities } from '@/hooks/use-activities'
import { Power, Server } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
// import type { Activity } from '@sia/models'

export default function AgentsPage() {
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const { data: agents = [] } = useQuery({
        queryKey: ['agents'],
        queryFn: api.getAgents,
        refetchInterval: 10000,
    })

    const { data: activities = [], isLoading: isLoadingActivities } = useActivities()

    const toggleStatusMutation = useMutation({
        mutationFn: api.toggleAgentStatus,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['agents'] })
            toast({
                title: 'Agent status updated',
                description: 'The agent status has been changed',
            })
        },
    })

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours}h ago`
        return `${Math.floor(diffHours / 24)}d ago`
    }




    return (
        <div className="flex flex-col h-full w-full bg-background">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Agents</h1>
                    <p className="text-muted-foreground">Manage your Sia execution agents</p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="gap-1">
                        <div className="h-2 w-2 rounded-full bg-status-active" />
                        {agents.filter(a => a.status === 'active').length} Active
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                        <div className="h-2 w-2 rounded-full bg-status-idle" />
                        {agents.filter(a => a.status === 'idle').length} Idle
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                        <div className="h-2 w-2 rounded-full bg-status-offline" />
                        {agents.filter(a => a.status === 'offline').length} Offline
                    </Badge>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 my-4">
                {agents.map((agent, index) => (
                    <Card key={agent.id} className="flex flex-col max-h-[calc(100vh-12rem)]">
                        <CardHeader>
                            <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Server className="h-5 w-5 text-primary" />
                                        {agent.name}
                                    </CardTitle>
                                    <StatusBadge status={agent.status} />
                                </div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => toggleStatusMutation.mutate(agent.id)}
                                    disabled={toggleStatusMutation.isPending}
                                >
                                    <Power className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4 overflow-y-hidden flex-1">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Machine Configuration
                                </p>
                                <div className="space-y-1 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">IP:</span>
                                        <span className="font-mono">{agent.config.ip}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Host:</span>
                                        <span className="font-mono">{agent.config.host}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Port:</span>
                                        <span className="font-mono">{agent.config.port}</span>
                                    </div>
                                </div>
                            </div>

                            <Separator />

                            <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                    Last Active
                                </p>
                                <p className="text-sm">{formatTime(agent.lastActive)}</p>
                            </div>

                            <Separator />

                            {/* Show activities for the first agent */}
                            {index === 0 && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                        Recent Activity
                                    </p>
                                    {isLoadingActivities ? (
                                        <p className="text-sm text-muted-foreground">Loading activities...</p>
                                    ) : activities.length > 0 ? (
                                        <div className="space-y-2">
                                            {activities.slice(0, 3).map((activity) => (
                                                <div key={activity.id} className="text-sm">
                                                    <p>{activity.name}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatTime(activity.created_at)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No recent activity</p>
                                    )}
                                </div>
                            )}

                            {/* Show simple recent activity for other agents */}
                            {index !== 0 && (
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                        Recent Activity
                                    </p>
                                    {agent.recentActivity.length > 0 ? (
                                        <div className="space-y-2">
                                            {agent.recentActivity.map((activity: { id: string; action: string; timestamp: string }) => (
                                                <div key={activity.id} className="text-sm">
                                                    <p>{activity.action}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {formatTime(activity.timestamp)}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No recent activity</p>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}


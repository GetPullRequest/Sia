"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ClipboardList } from 'lucide-react'
import type { JobResponse } from '@/types'

interface JobDescriptionProps {
    job: JobResponse
}

export function JobDescription({ job }: JobDescriptionProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[400px] overflow-y-auto">
                <p className="text-muted-foreground text-base leading-relaxed">
                    {job.generated_description ||
                        job.user_input?.prompt ||
                        'No description provided for this job.'}
                </p>
                <div className="rounded-2xl border border-dashed border-muted p-4">
                    <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        User Input
                    </p>
                    {job.user_input ? (
                        <div className="space-y-1 text-sm">
                            <p className="text-muted-foreground">
                                <span className="font-medium">Source:</span>{' '}
                                {job.user_input.source}
                            </p>
                            <p>{job.user_input.prompt}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            No user input was attached to this job.
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}


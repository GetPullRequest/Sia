"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface JobPullRequestProps {
    prLink: string | null | undefined
    confidenceScore: string | undefined
}

export function JobPullRequest({ prLink, confidenceScore }: JobPullRequestProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Pull Request</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
                <Button
                    variant="outline"
                    className="w-full flex flex-row items-center"
                    disabled={!prLink}
                >
                    <a
                        href={prLink || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className='flex flex-row items-center'
                        aria-disabled={!prLink}
                    >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {prLink ? 'View PR' : 'PR not available'}
                    </a>
                </Button>
                <div>
                    <p className="text-sm text-muted-foreground mb-1">Confidence Score</p>
                    <p className="text-3xl font-semibold">
                        {confidenceScore ?? '—'}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}


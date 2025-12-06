"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface JobMetadataProps {
    metadataItems: Array<{ label: string; value: string | number | undefined }>
}

export function JobMetadata({ metadataItems }: JobMetadataProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Job Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[300px] overflow-y-auto">
                {metadataItems.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className="text-sm font-medium text-foreground">{item.value ?? '—'}</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    )
}


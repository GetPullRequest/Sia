"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

interface JobCommentsProps {
    comments: Array<{ file_name: string; line_no: number; prompt: string }>
}

export function JobComments({ comments }: JobCommentsProps) {
    // Filter comments to only show those with available prompts
    const validComments = comments.filter(comment => comment.prompt && comment.prompt.trim() !== '')

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    User Comments
                </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-y-auto">
                {validComments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="rounded-full bg-muted p-3 mb-3">
                            <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">
                            No comments available
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                            Comments will appear here once added
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {validComments.map((comment, index) => (
                            <div
                                key={`comment-${index}`}
                                className="group rounded-lg border border-border/60 bg-card/60 p-4 transition-all hover:border-border hover:bg-card/80 hover:shadow-sm"
                            >
                                {/* File location badge */}
                                {comment.file_name && (
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge variant="secondary" className="text-xs font-mono">
                                            {comment.file_name}
                                            {comment.line_no && `:${comment.line_no}`}
                                        </Badge>
                                    </div>
                                )}

                                {/* Comment text */}
                                <p className="text-sm leading-relaxed text-foreground/90">
                                    {comment.prompt}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}


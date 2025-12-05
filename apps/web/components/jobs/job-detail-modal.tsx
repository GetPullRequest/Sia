"use client"

import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useJob } from '@/hooks/use-jobs'
import { JobDetail } from './job-detail'
import { Button } from '@/components/ui/button'
import { DialogTitle } from '@radix-ui/react-dialog'

interface JobDetailModalProps {
    jobId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function JobDetailModal({ jobId, open, onOpenChange }: JobDetailModalProps) {
    const { data: job, isLoading, isError } = useJob(jobId)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
                <DialogTitle className='text-center text-2xl font-semibold text-foreground flex justify-start p-6'>Job Details</DialogTitle>

                {/* <div className="sticky top-0 z-10 flex items-center justify-end p-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div> */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="flex h-[60vh] items-center justify-center">
                            <p className="text-muted-foreground">Loading job details…</p>
                        </div>
                    ) : isError || !job ? (
                        <div className="text-center py-12">
                            <p className="text-muted-foreground mb-4">
                                {isError
                                    ? 'Unable to load this job from the API.'
                                    : 'Job not found in the current workspace.'}
                            </p>
                            <Button onClick={() => onOpenChange(false)}>Close</Button>
                        </div>
                    ) : (
                        <JobDetail 
                            job={job} 
                            isLoading={isLoading} 
                            onClose={() => onOpenChange(false)} 
                            isModalOpen={open}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}

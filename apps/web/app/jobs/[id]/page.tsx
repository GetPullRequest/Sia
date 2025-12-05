"use client"

import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useJob } from '@/hooks/use-jobs'
import { JobDetail } from '@/components/jobs/job-detail'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default function JobDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()

  const jobId = useMemo(() => {
    if (!params?.id) return ''
    return Array.isArray(params.id) ? params.id[0] : params.id
  }, [params])

  const { data: job, isLoading, isError } = useJob(jobId)

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading job details…</p>
      </div>
    )
  }

  if (isError || !job) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          {isError
            ? 'Unable to load this job from the API.'
            : 'Job not found in the current workspace.'}
        </p>
        <Button onClick={() => router.push('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Button>
      </div>
    )
  }

  return <JobDetail job={job} isLoading={isLoading} />
}


"use client"

import { useState, useEffect } from 'react'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { JobBoard } from '@/components/home/job-board'
import type { JobResponse } from '@sia/models'
import { useToast } from '@/hooks/use-toast'
import { useJobs, useStartJobExecution } from '@/hooks/use-jobs'
import { Plus, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Repo } from '@/lib/api'
import { useAuthInfo } from '@propelauth/react'
import { Textarea } from '../ui/textarea'

export default function Index() {
  const { toast } = useToast()
  const { data: jobs = [], isLoading, isError, error } = useJobs();
  const queryClient = useQueryClient()
  const authInfo = useAuthInfo()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [availableRepos, setAvailableRepos] = useState<Repo[]>([])
  const [isLoadingRepos, setIsLoadingRepos] = useState(false)

  // Use the job execution hook
  const startJobMutation = useStartJobExecution()

  const handleStartJob = (id: string) => {
    startJobMutation.mutate(id, {
      onSuccess: (data) => {
        if (data?.message) {
          toast({
            description: data.message
          })
        }
      },
      onError: (error) => {
        const errorMessage = error ? error.message : 'An error occurred'
        toast({
          description: errorMessage,
          variant: 'destructive'
        })
      }
    })
  }

  const handleCancelJob = (id: string) => {
    // TODO: Implement API mutation to cancel job
    // For now, just show a toast
    toast({ title: 'Job cancelled', description: 'Execution has been cancelled' })
  }

  const handleSelectReviewJob = (job: JobResponse) => {
    // TODO: Implement review job selection logic
    console.log('Selected review job:', job)
  }

  const handleJobMoved = () => {
    // toast({
    //   title: 'Job updated',
    //   description: 'Job destination has been updated',
    // })
    console.log('Job moved')
  }

  // Mutation for creating a new job
  const createJobMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      return await api.createJob({
        user_input: {
          source: 'mobile', // Using 'mobile' as the source for web UI
          prompt: userPrompt,
          sourceMetadata: null,
        },
        repo: selectedRepoId || undefined, // Include selected repo ID
        created_by: authInfo.user?.userId || 'unknown',
      })
    },
    onSuccess: () => {
      // Invalidate and refetch jobs
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      toast({
        title: 'Task added',
        description: 'Your task has been submitted to the Sia agent',
      })
      setPrompt('')
      setSelectedRepoId('')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast({
        title: 'Failed to add task',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      })
    },
  })

  const handleAddTask = () => {
    if (prompt.trim()) {
      createJobMutation.mutate(prompt.trim())
    }
  }

  const handleCancel = () => {
    setPrompt('')
    setSelectedRepoId('')
    setIsModalOpen(false)
  }

  // Load repos when modal opens
  useEffect(() => {
    if (isModalOpen) {
      setIsLoadingRepos(true)
      api.getAllRepos()
        .then((repos) => {
          setAvailableRepos(repos)
        })
        .catch((error) => {
          console.error('Failed to load repos:', error)
          toast({
            title: 'Failed to load repos',
            description: 'Unable to load repositories. You can still create a job without selecting a repo.',
            variant: 'destructive',
          })
        })
        .finally(() => {
          setIsLoadingRepos(false)
        })
    }
  }, [isModalOpen, toast])

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-full w-full mx-auto overflow-hidden">
        <div className="flex flex-col h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-sm text-muted-foreground">Loading jobs...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (isError) {
    return (
      <div className="h-full w-full mx-auto overflow-hidden">
        <div className="flex flex-col h-full items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-destructive mb-2">Error loading jobs</h3>
              <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="mt-4"
                variant="outline"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className=" h-full  w-full  mx-auto overflow-hidden">
      {/* Grid Layout */}
      <div className="flex flex-col h-full  overflow-hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 rounded-full border border-border/60 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-status-running" />
              Live updates enabled
            </div>
            <Separator orientation="vertical" className="h-6" />
            <span>{jobs.length} total jobs</span>
          </div>
          <Button onClick={() => setIsModalOpen(true)} size="sm">
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden mx-auto">
          <JobBoard
            jobs={jobs}
            onJobsChange={() => {
              // TODO: Implement API mutation for job updates
              // For now, the jobs will be updated via refetch
            }}
            onStartJob={handleStartJob}
            onCancelJob={handleCancelJob}
            onSelectReviewJob={handleSelectReviewJob}
            onJobMoved={handleJobMoved}
          />
        </div>
      </div>

      {/* Add Task Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Enter a prompt for the Sia agent to execute
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="prompt-input" className="text-sm font-medium">
                Prompt
              </label>
              <Textarea
                id="prompt-input"
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="repo-select" className="text-sm font-medium">
                Repository (Optional)
              </label>
              <select
                id="repo-select"
                value={selectedRepoId}
                onChange={(e) => setSelectedRepoId(e.target.value)}
                disabled={isLoadingRepos}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingRepos ? (
                  <option value="">Loading repositories...</option>
                ) : availableRepos.length === 0 ? (
                  <option value="">No repositories available</option>
                ) : (
                  <>
                    <option value="">No repository (use default)</option>
                    {availableRepos.map((repo) => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {availableRepos.length === 0 && !isLoadingRepos && (
                <p className="text-xs text-muted-foreground">
                  No repositories configured. Connect a GitHub provider to add repositories.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={createJobMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!prompt.trim() || createJobMutation.isPending}
            >
              {createJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

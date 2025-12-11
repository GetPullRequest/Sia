'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { JobResponse } from '@/types';
import { Menu } from 'lucide-react';

interface JobDescriptionProps {
  job: JobResponse;
  generatedDescription: string;
  onGeneratedDescriptionChange: (value: string) => void;
}

export function JobDescription({
  job,
  generatedDescription,
  onGeneratedDescriptionChange,
}: JobDescriptionProps) {
  return (
    <Card className="bg-transparent shadow-none p-0">
      <CardHeader>
        <CardTitle className="text-base flex flex-wrap items-center gap-2">
          <Menu className="h-4 w-4" />
          <p>Description</p>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 ">
        <Textarea
          value={generatedDescription || ''}
          onChange={e => onGeneratedDescriptionChange(e.target.value)}
          className="text-sm min-h-[200px] overflow-hidden resize-none bg-card outline-none"
          placeholder="Add a short summary for this job..."
        />
        {/* <div className="rounded-2xl border border-dashed border-muted p-4">
          <p className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            User Input
          </p>
          {job.user_input ? (
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground">
                <span className="font-medium">Source:</span>{' '}
                {job.user_input.source}
              </p>
              <p>{job.user_input.prompt}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No user input was attached to this job.
            </p>
          )}
        </div> */}
      </CardContent>
    </Card>
  );
}

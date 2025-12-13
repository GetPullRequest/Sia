'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Copy } from 'lucide-react';

interface JobLogsProps {
  logSections: ReadonlyArray<{
    readonly key: string;
    readonly title: string;
    readonly content: string | null | undefined;
    readonly placeholder: string;
    readonly icon: React.ComponentType<{ className?: string }>;
  }>;
  logsOpen: { generation: boolean; verification: boolean };
  onLogsToggle: (key: string, isOpen: boolean) => void;
  onCopyLogs: (content: string, title: string) => void;
}

export function JobLogs({
  logSections,
  logsOpen,
  onLogsToggle,
  onCopyLogs,
}: JobLogsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Execution Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {logSections
          .filter(section => section.key === 'verification')
          .map(section => (
            <Collapsible
              key={section.key}
              open={logsOpen[section.key as keyof typeof logsOpen]}
              onOpenChange={isOpen => onLogsToggle(section.key, isOpen)}
              className="space-y-2"
            >
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <section.icon className="h-5 w-5 text-primary" />
                  <p className="font-semibold">{section.title}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={e => {
                      e.stopPropagation();
                      onCopyLogs(section.content || '', section.title);
                    }}
                    disabled={!section.content}
                  >
                    <Copy className="h-4 w-4" />
                    <span className="sr-only">Copy logs</span>
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronDown className="h-5 w-5 transition-transform duration-200 group-data-[state=open]:-rotate-180" />
                      <span className="sr-only">Toggle logs</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </div>
              <CollapsibleContent>
                <div className="rounded-b-lg border border-border/70 border-t-0 bg-sidebar">
                  <ScrollArea className="h-full">
                    <pre className=" p-4 text-xs font-mono text-foreground bg-sidebar">
                      {section.content || section.placeholder}
                    </pre>
                  </ScrollArea>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
      </CardContent>
    </Card>
  );
}

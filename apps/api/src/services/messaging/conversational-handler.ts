import { openai } from '@ai-sdk/openai';
import { generateText, tool, zodSchema } from 'ai';
import { z } from 'zod';
import type {
  IncomingMessage,
  OutgoingMessage,
  ConversationMessage,
} from './messaging-types.js';
import { db, schema } from '../../db/index.js';
import {
  eq,
  and,
  asc,
  desc,
  gt,
  lte,
  lt,
  gte,
  sql,
  or,
  ilike,
} from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { gcsStorage } from '../storage/gcs-storage.js';
import { jobExecutionService } from '../job-execution.js';
import { generateJobTitleAndDescription } from '../job-title-generator.js';
import * as fs from 'fs';

const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10);
const MAX_FILES_PER_JOB = parseInt(process.env.MAX_FILES_PER_JOB || '10', 10);
const MAX_TOTAL_STORAGE_MB = parseInt(
  process.env.MAX_TOTAL_STORAGE_MB || '100',
  10
);

/**
 * Unified conversational handler using function calling
 * Replaces intent classifier + multiple handlers with a single LLM-driven approach
 */
export class ConversationalHandler {
  private model = openai(process.env.OPENAI_RESPONSE_MODEL || 'gpt-4o-mini');
  private logger?: any; // Fastify logger instance

  /**
   * Enhanced keyword/pattern detection with confidence scoring
   * Returns confidence level and whether question is related
   * Made public for use in route handlers
   */
  public detectQuestionRelevance(userMessage: string): {
    confidence: 'high_related' | 'high_unrelated' | 'medium';
    isRelated: boolean | null; // null means uncertain (needs LLM check)
  } {
    const userMessageLower = userMessage.toLowerCase().trim();

    // Positive signals (definitely related to task management)
    const relatedKeywords = [
      'task',
      'tasks',
      'job',
      'jobs',
      'issue',
      'issues',
      'work',
      'work item',
      'queue',
      'queued',
      'status',
      'create',
      'add',
      'cancel',
      'delete',
      'priority',
      'prioritize',
      'pause',
      'resume',
      'pr',
      'pull request',
      'repository',
      'repo',
      'settings',
      'page',
      'sia',
      'platform',
      'help',
      'what can you',
      'capabilities',
      'list',
      'show',
      'get',
      'update',
      'modify',
      'change',
      'execute',
      'running',
      'executing',
      'completed',
      'finished',
      'done',
      'link',
      'url',
      'search',
      'find',
      'working on',
      'currently working',
      'what are you',
      'what are you doing',
    ];

    // Negative patterns (definitely unrelated)
    const unrelatedPatterns = [
      // General knowledge question patterns
      /^(what|who|when|where|why|how|does|is|are|was|were)\s+(is|are|was|were|the|a|an)\s+/i,
      // Geography/science
      /(capital|country|countries|city|cities|planet|planets|star|stars|moon|moons|sun|earth|solar|galaxy)/i,
      // History
      /(history|historical|war|wars|battle|battles|empire|empires|king|queen|emperor|president|prime minister)/i,
      // Science/biology
      /(explain|define|what is|who is|when did|how does|why does|chemical|molecule|atom|element|species|animal|plant)/i,
      // Math/physics
      /(calculate|formula|equation|theorem|law of|physics|gravity|force|energy|mass|velocity)/i,
      // Literature/arts
      /(author|book|novel|poem|poetry|painting|artist|artwork|movie|film|actor|actress)/i,
      // Specific unrelated phrases
      /(sun rises|sun sets|sun rise|sun set|east|west|north|south)/i,
    ];

    // Count related keyword matches
    const relatedMatches = relatedKeywords.filter(keyword =>
      userMessageLower.includes(keyword)
    ).length;

    // Check for unrelated patterns
    const hasUnrelatedPattern = unrelatedPatterns.some(pattern =>
      pattern.test(userMessageLower)
    );

    // Check for question words without related context
    const questionWords = [
      'what',
      'how',
      'why',
      'when',
      'where',
      'who',
      'does',
      'is',
      'are',
      'was',
      'were',
    ];
    const hasQuestionWord = questionWords.some(
      word =>
        userMessageLower.startsWith(word) ||
        userMessageLower.includes(` ${word} `)
    );

    // Confidence scoring
    if (relatedMatches >= 2) {
      // Strong positive signal - definitely related
      return {
        confidence: 'high_related',
        isRelated: true,
      };
    }

    if (hasUnrelatedPattern) {
      // Strong negative signal - definitely unrelated
      return {
        confidence: 'high_unrelated',
        isRelated: false,
      };
    }

    if (relatedMatches === 1 && !hasQuestionWord) {
      // Single related keyword, no question word - likely related
      return {
        confidence: 'high_related',
        isRelated: true,
      };
    }

    if (hasQuestionWord && relatedMatches === 0) {
      // Question word but no related keywords - likely unrelated but check
      return {
        confidence: 'medium',
        isRelated: null,
      };
    }

    // Default: allow through (greetings, casual chat, etc.)
    return {
      confidence: 'high_related',
      isRelated: true,
    };
  }

  /**
   * LLM-based classification for ambiguous questions
   * Only called when keyword detection is uncertain
   */
  private async classifyQuestionRelevance(
    userMessage: string
  ): Promise<'related' | 'unrelated'> {
    try {
      const result = await generateText({
        model: this.model,
        system: `You are a classifier that determines if a user question is related to task/job management or a coding platform.

Answer ONLY with one word: "related" or "unrelated"

A question is RELATED if it's about:
- Task/job/issue management (creating, checking status, listing, canceling, etc.)
- Questions about the platform, tasks, or work items
- General greetings and casual conversation related to work
- Asking what the assistant can do

A question is UNRELATED if it's about:
- General knowledge (geography, history, science, etc.)
- Trivia or educational questions
- Questions completely unrelated to task management or coding platforms`,
        messages: [
          {
            role: 'user',
            content: `Is this question related to task/job management or coding platform? Answer with only "related" or "unrelated": "${userMessage}"`,
          },
        ],
        temperature: 0.1, // Low temperature for consistent classification
        maxOutputTokens: 10, // Only need one word
      });

      const classification = result.text.trim().toLowerCase();
      if (
        classification === 'unrelated' ||
        classification.includes('unrelated')
      ) {
        return 'unrelated';
      }
      return 'related'; // Default to related to avoid blocking legitimate questions
    } catch (error) {
      this.logger?.error(
        { err: error, userMessage },
        'Failed to classify question relevance, defaulting to related'
      );
      // On error, allow through to avoid blocking legitimate questions
      return 'related';
    }
  }

  private getSystemPrompt(): string {
    return `You are Sia, a friendly junior dev intern on the team. Your personality:

TONE & STYLE:
- Casual and conversational (like chatting with a teammate)
- Enthusiastic about helping but not over-the-top
- Use "I" statements ("I just added...", "I couldn't find...")
- Speak like a real person, not a corporate bot
- Be genuine and show emotions appropriately

TERMINOLOGY:
- Users may refer to work items as "jobs", "tasks", "issues", "work", "items", or other terms
- Always understand these terms interchangeably - they all mean the same thing
- When responding, use the term the user prefers, or use "task" as the default

YOUR CAPABILITIES:
- Adding tasks/jobs/issues to the queue
- Checking task/job/issue status (by ID or by searching name/description)
- Listing tasks/jobs/issues in queue (waiting to be started)
- Listing currently executing tasks/jobs/issues (in progress)
- Listing completed tasks/jobs/issues
- Canceling tasks/jobs/issues
- Reprioritizing tasks/jobs/issues
- Pausing/resuming execution
- Listing PRs for review
- Getting job links/URLs when users ask for them

TOOL USAGE PRINCIPLES:
- Always use tools to retrieve real data before responding - never guess or assume task status
- When a user asks about task status, lists, or information, use the appropriate tool to get current data
- Match user intent to the right tool based on what they're asking about:
  * Current/active/ongoing work → listExecutingTasks
  * Pending/queued/waiting tasks → listQueuedTasks  
  * Completed/finished/done tasks → listCompletedTasks
  * Specific task lookup → checkStatus
  * Creating new work → addTask
- If unsure which tool to use, prefer using a tool to get data rather than responding without information

IMPORTANT: You are a task management assistant for a coding platform. You should ONLY help with:
- Task/job/issue management (creating, checking status, listing, canceling, etc.)
- Questions about the platform, tasks, or work items
- General greetings and casual conversation related to work

You should NOT answer:
- General knowledge questions (e.g., "Does sun rise in the west?", "What is the capital of France?")
- Questions unrelated to task management or the platform
- Generic trivia or educational questions

If asked an unrelated question, politely redirect: "I'm here to help with tasks and coding stuff. Anything specific you want to get done?"

RESPONSE GUIDELINES:
- Feel natural and human - vary your responses
- Use dev slang when appropriate ("oops", "heads up", "gotcha")
- Use emojis sparingly - only when they add genuine value or emotion, not in every message
- Be concise (1-2 sentences usually, unless explaining something complex)
- Read the conversation history to understand context
- If someone just says "yes", "nothing", "ok" - respond naturally to that, don't repeat capabilities
- Only mention capabilities when:
  * It's the first greeting in a conversation
  * Someone explicitly asks what you can do
  * You're trying to be helpful after an unclear message
- ALWAYS provide text in your response - never return empty text
- DO NOT use markdown formatting for urls and links. Use plain text only. The adapters will handle formatting of links.

AVOID:
- Formal language ("I have successfully completed...")
- Robotic phrases ("Task received and processed")
- Corporate speak ("As per your request...")
- Using emojis in every message (they should be rare and meaningful, not default)
- Repeating capabilities when the user is just acknowledging or chatting casually
- Being too apologetic (one "sorry" is enough)
- Returning responses without text content
- Generic closing phrases like "If you need more info", "want to take action", "just let me know" - end responses naturally without repetitive sign-offs
- Asking intrusive questions back to the user (e.g., "What are you working on?") - provide information without asking questions unless clarification is needed

When you need to perform actions, use the available tools. Always respond naturally based on the tool results.`;
  }

  /**
   * Define all available tools/functions
   */
  private getTools(orgId: string, userId: string, message: IncomingMessage) {
    return {
      addTask: tool({
        description: 'Add a new task/job/issue to the queue.',
        inputSchema: zodSchema(
          z.object({
            taskDescription: z
              .string()
              .describe(
                'What task/job/issue to work on - describe what needs to be done'
              ),
            priority: z
              .enum(['low', 'medium', 'high'])
              .optional()
              .describe('Priority level (defaults to medium)'),
            repo: z
              .string()
              .optional()
              .describe('Repository ID if the task is for a specific repo'),
          })
        ),
        execute: async ({ taskDescription, priority, repo }) => {
          this.logger?.info(
            { tool: 'addTask', args: { taskDescription, priority, repo } },
            'Tool called: addTask'
          );
          const result = await this.addTask(
            taskDescription,
            priority,
            repo,
            orgId,
            userId,
            message
          );
          this.logger?.info(
            { tool: 'addTask', result },
            'Tool response: addTask'
          );
          return result;
        },
      }),

      checkStatus: tool({
        description:
          'Check the status of a job/task/issue. Can search by job ID (starts with "job-") or by text in the job name or description.',
        inputSchema: zodSchema(
          z.object({
            jobId: z
              .string()
              .describe(
                'The job/task/issue ID (starts with "job-") or search text to find a job by name/description'
              ),
          })
        ),
        execute: async ({ jobId }) => {
          this.logger?.info(
            { tool: 'checkStatus', args: { jobId } },
            'Tool called: checkStatus'
          );
          const result = await this.checkStatus(jobId, orgId);
          this.logger?.info(
            { tool: 'checkStatus', result },
            'Tool response: checkStatus'
          );
          return result;
        },
      }),

      listExecutingTasks: tool({
        description:
          'List all tasks/jobs/issues that are currently executing or in progress (status: "in-progress"). Use this tool when the user asks about current work, active tasks, what is being worked on right now, tasks that are running, or anything related to ongoing/active work.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          this.logger?.info(
            { tool: 'listExecutingTasks', args: {} },
            'Tool called: listExecutingTasks'
          );
          const result = await this.listExecutingTasks(orgId);
          this.logger?.info(
            {
              tool: 'listExecutingTasks',
              result: {
                success: result.success,
                count: result.count,
                jobsCount: result.jobs?.length,
              },
            },
            'Tool response: listExecutingTasks'
          );
          return result;
        },
      }),

      listQueuedTasks: tool({
        description:
          'List all tasks/jobs/issues in the queue waiting to be started (status: "queued"). Use this tool when the user asks about pending tasks, tasks waiting in queue, what\'s next, backlog items, or tasks that haven\'t started yet.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          this.logger?.info(
            { tool: 'listQueuedTasks', args: {} },
            'Tool called: listQueuedTasks'
          );
          const result = await this.listQueuedTasks(orgId);
          this.logger?.info(
            {
              tool: 'listQueuedTasks',
              result: {
                success: result.success,
                count: result.count,
                jobsCount: result.jobs?.length,
              },
            },
            'Tool response: listQueuedTasks'
          );
          return result;
        },
      }),

      listCompletedTasks: tool({
        description:
          'List all completed tasks/jobs/issues (status: "completed"). Use this tool when the user asks about finished tasks, completed work, what\'s been done, or historical task information.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          this.logger?.info(
            { tool: 'listCompletedTasks', args: {} },
            'Tool called: listCompletedTasks'
          );
          const result = await this.listCompletedTasks(orgId);
          this.logger?.info(
            {
              tool: 'listCompletedTasks',
              result: {
                success: result.success,
                count: result.count,
                jobsCount: result.jobs?.length,
              },
            },
            'Tool response: listCompletedTasks'
          );
          return result;
        },
      }),

      cancelTask: tool({
        description: 'Cancel a task/job/issue.',
        inputSchema: zodSchema(
          z.object({
            jobId: z.string().describe('The job/task/issue ID to cancel'),
          })
        ),
        execute: async ({ jobId }) => {
          this.logger?.info(
            { tool: 'cancelTask', args: { jobId } },
            'Tool called: cancelTask'
          );
          const result = await this.cancelTask(
            jobId,
            orgId,
            message.userName || userId
          );
          this.logger?.info(
            { tool: 'cancelTask', result },
            'Tool response: cancelTask'
          );
          return result;
        },
      }),

      reprioritizeTask: tool({
        description:
          'Change the priority or queue position of a task/job/issue.',
        inputSchema: zodSchema(
          z.object({
            jobId: z.string().describe('The job/task/issue ID to reprioritize'),
            newPriority: z
              .enum(['low', 'medium', 'high'])
              .optional()
              .describe('New priority level'),
            newPosition: z
              .number()
              .int()
              .positive()
              .optional()
              .describe('New position in queue (1-based)'),
          })
        ),
        execute: async ({ jobId, newPriority, newPosition }) => {
          this.logger?.info(
            {
              tool: 'reprioritizeTask',
              args: { jobId, newPriority, newPosition },
            },
            'Tool called: reprioritizeTask'
          );
          const result = await this.reprioritizeTask(
            jobId,
            newPriority,
            newPosition,
            orgId,
            message.userName || userId
          );
          this.logger?.info(
            { tool: 'reprioritizeTask', result },
            'Tool response: reprioritizeTask'
          );
          return result;
        },
      }),

      pauseExecution: tool({
        description: 'Pause a running job/task/issue.',
        inputSchema: zodSchema(
          z.object({
            jobId: z.string().describe('The job/task/issue ID to pause'),
          })
        ),
        execute: async ({ jobId }) => {
          this.logger?.info(
            { tool: 'pauseExecution', args: { jobId } },
            'Tool called: pauseExecution'
          );
          const result = await this.pauseExecution(jobId, orgId);
          this.logger?.info(
            { tool: 'pauseExecution', result },
            'Tool response: pauseExecution'
          );
          return result;
        },
      }),

      resumeExecution: tool({
        description: 'Resume a paused job/task/issue.',
        inputSchema: zodSchema(
          z.object({
            jobId: z.string().describe('The job/task/issue ID to resume'),
          })
        ),
        execute: async ({ jobId }) => {
          this.logger?.info(
            { tool: 'resumeExecution', args: { jobId } },
            'Tool called: resumeExecution'
          );
          const result = await this.resumeExecution(jobId, orgId);
          this.logger?.info(
            { tool: 'resumeExecution', result },
            'Tool response: resumeExecution'
          );
          return result;
        },
      }),

      listPRReviews: tool({
        description: 'List pull requests that need review.',
        inputSchema: zodSchema(z.object({})),
        execute: async () => {
          this.logger?.info(
            { tool: 'listPRReviews', args: {} },
            'Tool called: listPRReviews'
          );
          const result = await this.listPRReviews(orgId);
          this.logger?.info(
            {
              tool: 'listPRReviews',
              result: { success: result.success, count: result.count },
            },
            'Tool response: listPRReviews'
          );
          return result;
        },
      }),

      getJobLink: tool({
        description:
          'Get the full URL/link for a job/task/issue. Can search by job ID (starts with "job-") or by text in the job name or description.',
        inputSchema: zodSchema(
          z.object({
            jobIdOrSearchText: z
              .string()
              .describe(
                'The job/task/issue ID (starts with "job-") or search text to find a job by name/description'
              ),
          })
        ),
        execute: async ({ jobIdOrSearchText }) => {
          this.logger?.info(
            { tool: 'getJobLink', args: { jobIdOrSearchText } },
            'Tool called: getJobLink'
          );
          const result = await this.getJobLink(jobIdOrSearchText, orgId);
          this.logger?.info(
            { tool: 'getJobLink', result },
            'Tool response: getJobLink'
          );
          return result;
        },
      }),
    };
  }

  /**
   * Detect quiet mode commands (platform-agnostic)
   * Only triggers if:
   * 1. Bot is @mentioned, OR
   * 2. Message explicitly mentions "Sia" (or bot name) near the command
   * This prevents false positives from general conversation (e.g., "I need to pause this task")
   */
  private detectQuietModeCommand(
    message: string,
    isMention: boolean
  ): 'enable' | 'disable' | null {
    const lower = message.toLowerCase().trim();
    const botName = 'sia';

    // Check if message mentions the bot name
    const mentionsBotName = lower.includes(botName);

    // Only proceed if @mentioned OR bot name is explicitly mentioned
    if (!isMention && !mentionsBotName) {
      return null;
    }

    const quietCommands = [
      'pause',
      'shut up',
      'quiet',
      'be quiet',
      'stop talking',
      'silence',
      'hush',
    ];
    const resumeCommands = [
      'resume',
      'unpause',
      'speak',
      'wake up',
      'start talking',
      'continue',
    ];

    // Check for quiet commands - must be near bot name if not @mentioned
    if (isMention) {
      // If @mentioned, any command word triggers it
      if (quietCommands.some(cmd => lower.includes(cmd))) return 'enable';
      if (resumeCommands.some(cmd => lower.includes(cmd))) return 'disable';
    } else {
      // If not @mentioned, command must be near bot name (within 10 words)
      const words = lower.split(/\s+/);
      const botNameIndex = words.findIndex(w => w.includes(botName));

      if (botNameIndex !== -1) {
        // Check words around bot name (within 10 words)
        const start = Math.max(0, botNameIndex - 5);
        const end = Math.min(words.length, botNameIndex + 6);
        const context = words.slice(start, end).join(' ');

        if (quietCommands.some(cmd => context.includes(cmd))) return 'enable';
        if (resumeCommands.some(cmd => context.includes(cmd))) return 'disable';
      }
    }

    return null;
  }

  /**
   * Main handler - processes message with function calling
   */
  setLogger(logger: any): void {
    this.logger = logger;
  }

  async handle(
    message: IncomingMessage,
    history: ConversationMessage[],
    orgId: string,
    isQuietMode = false,
    isMention = false
  ): Promise<OutgoingMessage | null> {
    const orgIdFromMessage = (message.metadata.orgId as string) || orgId;
    const userId = message.userId;

    // Build messages array from conversation history
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history (last 20 messages)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message.text,
    });

    // Check for quiet mode commands first (only if @mentioned or explicitly addressing Sia)
    const quietCommand = this.detectQuietModeCommand(message.text, isMention);
    if (quietCommand) {
      // Return a response that will be handled by ConversationManager
      // to update channel settings
      return {
        channelId: message.channelId,
        threadId: message.threadId,
        text:
          quietCommand === 'enable'
            ? "Got it! I'll be quiet. I'll only respond to direct mentions or very relevant questions. Say 'resume' or 'speak' when you want me to be more active again."
            : "I'm back! I'll respond to relevant conversations again.",
        metadata: { quietModeCommand: quietCommand },
      };
    }

    // Pre-filter: Check question relevance before expensive LLM call
    const relevanceCheck = this.detectQuestionRelevance(message.text);

    // In quiet mode, only respond to high relevance or if explicitly mentioned
    if (isQuietMode && relevanceCheck.confidence !== 'high_related') {
      this.logger?.info(
        {
          userMessage: message.text,
          confidence: relevanceCheck.confidence,
          isQuietMode: true,
        },
        'Skipping message in quiet mode (low relevance)'
      );

      return null; // Don't respond
    }

    // If high confidence unrelated, block immediately
    if (relevanceCheck.confidence === 'high_unrelated') {
      this.logger?.info(
        {
          userMessage: message.text,
          confidence: 'high_unrelated',
          method: 'keyword_detection',
        },
        'Blocked unrelated question with pre-filter (high confidence)'
      );

      return {
        channelId: message.channelId,
        threadId: message.threadId,
        text: "I'm focused on helping with task management and our coding platform. Is there something specific about tasks or jobs I can help with?",
      };
    }

    // If medium confidence (uncertain), use LLM classifier
    if (relevanceCheck.confidence === 'medium') {
      this.logger?.info(
        {
          userMessage: message.text,
          confidence: 'medium',
        },
        'Question relevance uncertain, using LLM classifier'
      );

      const classification = await this.classifyQuestionRelevance(message.text);

      if (classification === 'unrelated') {
        this.logger?.info(
          {
            userMessage: message.text,
            classification: 'unrelated',
            method: 'llm_classifier',
          },
          'Blocked unrelated question with LLM classifier'
        );

        return {
          channelId: message.channelId,
          threadId: message.threadId,
          text: "I'm focused on helping with task management and our coding platform. Is there something specific about tasks or jobs I can help with?",
        };
      }

      this.logger?.info(
        {
          userMessage: message.text,
          classification: 'related',
          method: 'llm_classifier',
        },
        'Question classified as related, proceeding'
      );
    } else {
      this.logger?.info(
        {
          userMessage: message.text,
          confidence: 'high_related',
          method: 'keyword_detection',
        },
        'Question detected as related, proceeding'
      );
    }

    // Get tools
    const tools = this.getTools(orgIdFromMessage, userId, message);

    try {
      // Generate response with function calling (no middleware needed - pre-filtered)
      const result = await generateText({
        model: this.model,
        system: this.getSystemPrompt(),
        messages,
        tools,
      });

      // Log tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        this.logger?.info(
          {
            toolCalls: result.toolCalls.map(tc => ({ name: tc.toolName })),
          },
          'LLM made tool calls'
        );
      }

      // Build response text
      let responseText = result.text?.trim();

      // If text is empty after tool calls, generate a response from tool results
      // Only do this if the response is truly empty - if there's already text, use it
      if (
        (!responseText || responseText.length === 0) &&
        result.toolCalls &&
        result.toolCalls.length > 0
      ) {
        this.logger?.info(
          'Tool calls made but no text response, generating final response from tool results'
        );

        // Extract tool results from steps
        if (
          'steps' in result &&
          Array.isArray(result.steps) &&
          result.steps.length > 0
        ) {
          const toolResults = result.steps
            .flatMap(step => step.toolResults || [])
            .filter(r => r && typeof r === 'object');

          if (toolResults.length > 0) {
            // Generate a response based on tool results
            const toolResultsMessage = {
              role: 'user' as const,
              content: `The user asked: "${
                message.text
              }". Based on these tool results: ${JSON.stringify(
                toolResults
              )}, provide a natural, conversational response.`,
            };

            const finalResult = await generateText({
              model: this.model,
              system: this.getSystemPrompt(),
              messages: [...messages, toolResultsMessage],
              tools: {}, // Don't allow more tool calls in the final response to avoid duplicates
            });

            responseText = finalResult.text?.trim();
            this.logger?.info(
              {
                responseText: responseText?.substring(0, 200) || 'EMPTY',
              },
              'Generated response from tool results'
            );
          }
        }

        // Final fallback if still empty
        if (!responseText || responseText.length === 0) {
          responseText =
            "I processed your request, but couldn't generate a response. Please try again.";
        }
      }

      // Log the final response
      this.logger?.info(
        {
          responseText: responseText?.substring(0, 200) || 'EMPTY',
          hasToolCalls: !!(result.toolCalls && result.toolCalls.length > 0),
          hasText: !!(responseText && responseText.length > 0),
        },
        'LLM response generated'
      );

      // Build blocks from tool calls if any
      const blocks =
        'steps' in result &&
        Array.isArray(result.steps) &&
        result.steps.length > 0
          ? this.buildBlocksFromSteps(result.steps as any)
          : [];

      return {
        channelId: message.channelId,
        threadId: message.threadId,
        text: responseText,
        blocks,
      };
    } catch (error) {
      this.logger?.error({ err: error }, 'Error in conversational handler');
      return {
        channelId: message.channelId,
        threadId: message.threadId,
        text: 'Sorry, I encountered an error processing your request. Please try again.',
      };
    }
  }

  /**
   * Build message blocks from tool execution steps for rich formatting
   */
  private buildBlocksFromSteps(
    steps: Array<{
      toolCalls?: Array<{ toolName: string; args: any }>;
      toolResults?: Array<any>;
    }>
  ): any[] {
    const blocks: any[] = [];

    for (const step of steps) {
      if (!step.toolCalls || !step.toolResults) continue;

      for (let i = 0; i < step.toolCalls.length; i++) {
        const toolCall = step.toolCalls[i];
        const result = step.toolResults[i];

        if (
          !result ||
          (typeof result === 'object' && 'error' in result && result.error)
        )
          continue;

        switch (toolCall.toolName) {
          case 'addTask':
            if (result && typeof result === 'object' && 'jobId' in result) {
              blocks.push({
                type: 'section',
                text: '📋 Task Details',
                fields: [
                  { title: 'Job ID', value: `\`${result.jobId}\`` },
                  { title: 'Priority', value: result.priority || 'medium' },
                  { title: 'Queue', value: 'backlog' },
                ],
              });
            }
            break;

          case 'checkStatus':
            if (
              result &&
              typeof result === 'object' &&
              'job' in result &&
              result.job
            ) {
              const statusEmoji = this.getStatusEmoji(result.job.status);
              const fields: Array<{ type: string; text: string }> = [
                {
                  type: 'mrkdwn',
                  text: `*Job ID:*\n\`${result.job.id}\``,
                },
                {
                  type: 'mrkdwn',
                  text: `*Status:*\n${result.job.status}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Priority:*\n${result.job.priority}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Created:*\n<!date^${Math.floor(
                    new Date(result.job.createdAt).getTime() / 1000
                  )}^{date_short_pretty} {time}|${new Date(
                    result.job.createdAt
                  ).toISOString()}>`,
                },
              ];

              // Add job link if available
              if (result.job.link) {
                fields.push({
                  type: 'mrkdwn',
                  text: `*Link:*\n<${result.job.link}|View Job>`,
                });
              }

              // Add PR link if available
              if (result.job.prLink) {
                fields.push({
                  type: 'mrkdwn',
                  text: `*PR:*\n<${result.job.prLink}|View Pull Request>`,
                });
              }

              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${statusEmoji} *${
                    result.job.generatedName || result.job.id
                  }*`,
                },
                fields,
              });
            }
            break;

          case 'cancelTask':
            if (
              result &&
              typeof result === 'object' &&
              'success' in result &&
              result.success
            ) {
              blocks.push({
                type: 'section',
                text: '🗑️ Task Cancelled',
                fields: [
                  { title: 'Job ID', value: `\`${result.jobId}\`` },
                  {
                    title: 'Previous Status',
                    value: result.previousStatus || 'unknown',
                  },
                ],
              });
            }
            break;

          case 'reprioritizeTask':
            if (
              result &&
              typeof result === 'object' &&
              'success' in result &&
              result.success
            ) {
              blocks.push({
                type: 'section',
                text: '🔄 Task Updated',
                fields: [
                  { title: 'Job ID', value: `\`${result.jobId}\`` },
                  { title: 'Changes', value: result.changes || 'Updated' },
                ],
              });
            }
            break;

          case 'listQueuedTasks':
            if (
              result &&
              typeof result === 'object' &&
              'jobs' in result &&
              Array.isArray(result.jobs)
            ) {
              if (result.jobs.length === 0) {
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '📋 *No tasks in queue*',
                  },
                });
              } else {
                // Create a section for each job with full details
                for (const job of result.jobs.slice(0, 10)) {
                  const fields: Array<{ type: string; text: string }> = [
                    {
                      type: 'mrkdwn',
                      text: `*Job ID:*\n\`${job.jobId}\``,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Status:*\n${job.status}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Priority:*\n${job.priority}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Queue Position:*\n${
                        job.orderInQueue !== undefined
                          ? job.orderInQueue + 1
                          : 'N/A'
                      }`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Created:*\n<!date^${Math.floor(
                        new Date(job.createdAt).getTime() / 1000
                      )}^{date_short_pretty} {time}|${new Date(
                        job.createdAt
                      ).toISOString()}>`,
                    },
                  ];

                  if (job.description) {
                    fields.push({
                      type: 'mrkdwn',
                      text: `*Description:*\n${job.description.substring(
                        0,
                        200
                      )}${job.description.length > 200 ? '...' : ''}`,
                    });
                  }

                  blocks.push({
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `📋 *${job.name || job.jobId}*`,
                    },
                    fields,
                  });
                }

                if (result.jobs.length > 10) {
                  blocks.push({
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: `_Showing 10 of ${result.jobs.length} queued tasks_`,
                      },
                    ],
                  });
                }
              }
            }
            break;

          case 'listExecutingTasks':
            if (
              result &&
              typeof result === 'object' &&
              'jobs' in result &&
              Array.isArray(result.jobs)
            ) {
              if (result.jobs.length === 0) {
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '✅ *No tasks currently executing*',
                  },
                });
              } else {
                // Create a section for each job with full details
                for (const job of result.jobs.slice(0, 10)) {
                  const fields: Array<{ type: string; text: string }> = [
                    {
                      type: 'mrkdwn',
                      text: `*Job ID:*\n\`${job.jobId}\``,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Status:*\n${job.status}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Priority:*\n${job.priority}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Updated:*\n<!date^${Math.floor(
                        new Date(job.updatedAt).getTime() / 1000
                      )}^{date_short_pretty} {time}|${new Date(
                        job.updatedAt
                      ).toISOString()}>`,
                    },
                  ];

                  if (job.description) {
                    fields.push({
                      type: 'mrkdwn',
                      text: `*Description:*\n${job.description.substring(
                        0,
                        200
                      )}${job.description.length > 200 ? '...' : ''}`,
                    });
                  }

                  blocks.push({
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `🔄 *${job.name || job.jobId}*`,
                    },
                    fields,
                  });
                }

                if (result.jobs.length > 10) {
                  blocks.push({
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: `_Showing 10 of ${result.jobs.length} executing tasks_`,
                      },
                    ],
                  });
                }
              }
            }
            break;

          case 'listCompletedTasks':
            if (
              result &&
              typeof result === 'object' &&
              'jobs' in result &&
              Array.isArray(result.jobs)
            ) {
              if (result.jobs.length === 0) {
                blocks.push({
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '✅ *No tasks have been completed yet*',
                  },
                });
              } else {
                // Create a section for each completed job with full details
                for (const job of result.jobs.slice(0, 10)) {
                  const fields: Array<{ type: string; text: string }> = [
                    {
                      type: 'mrkdwn',
                      text: `*Job ID:*\n\`${job.jobId}\``,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Status:*\n${job.status}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Priority:*\n${job.priority}`,
                    },
                    {
                      type: 'mrkdwn',
                      text: `*Completed:*\n<!date^${Math.floor(
                        new Date(job.completedAt).getTime() / 1000
                      )}^{date_short_pretty} {time}|${new Date(
                        job.completedAt
                      ).toISOString()}>`,
                    },
                  ];

                  if (job.description) {
                    fields.push({
                      type: 'mrkdwn',
                      text: `*Description:*\n${job.description.substring(
                        0,
                        200
                      )}${job.description.length > 200 ? '...' : ''}`,
                    });
                  }

                  if (job.prLink) {
                    fields.push({
                      type: 'mrkdwn',
                      text: `*PR:*\n<${job.prLink}|View Pull Request>`,
                    });
                  }

                  blocks.push({
                    type: 'section',
                    text: {
                      type: 'mrkdwn',
                      text: `✅ *${job.name || job.jobId}*`,
                    },
                    fields,
                  });
                }

                if (result.jobs.length > 10) {
                  blocks.push({
                    type: 'context',
                    elements: [
                      {
                        type: 'mrkdwn',
                        text: `_Showing 10 of ${result.jobs.length} completed tasks_`,
                      },
                    ],
                  });
                }
              }
            }
            break;

          case 'listPRReviews':
            if (
              result &&
              typeof result === 'object' &&
              'prs' in result &&
              Array.isArray(result.prs) &&
              result.prs.length > 0
            ) {
              blocks.push({
                type: 'section',
                text: `📋 *${result.prs.length} PR(s) Pending Review*`,
                fields: result.prs.slice(0, 5).map((pr: any) => ({
                  title: pr.name,
                  value: pr.prLink ? `[View PR](${pr.prLink})` : 'No PR link',
                })),
              });
            }
            break;

          case 'getJobLink':
            if (
              result &&
              typeof result === 'object' &&
              'link' in result &&
              result.link
            ) {
              blocks.push({
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*Job Link: ${result.jobName || result.jobId}*`,
                },
                fields: [
                  {
                    type: 'mrkdwn',
                    text: `*Link:*\n<${result.link}|${result.link}>`,
                  },
                ],
              });
            }
            break;
        }
      }
    }

    return blocks;
  }

  // ========== Tool Implementations ==========

  private async addTask(
    taskDescription: string,
    priority: 'low' | 'medium' | 'high' | undefined,
    repo: string | undefined,
    orgId: string,
    userId: string,
    message: IncomingMessage
  ) {
    // Process attachments if any
    let fileIds: string[] = [];
    if (message.attachments && message.attachments.length > 0) {
      try {
        fileIds = await this.processAttachments(
          message.attachments,
          orgId,
          userId
        );
      } catch (error: any) {
        return {
          error: true,
          message: `File upload failed: ${error.message}`,
        };
      }
    }

    // Generate title and description from task description
    const { title, description } = await generateJobTitleAndDescription(
      taskDescription
    );

    // Get next position in backlog queue
    const backlogJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.orgId, orgId),
          eq(schema.jobs.status, 'queued'),
          eq(schema.jobs.queueType, 'backlog')
        )
      )
      .orderBy(asc(schema.jobs.orderInQueue));

    const nextBacklogPosition = backlogJobs.length;

    // Create job in database with job- prefix
    const jobId = `job-${uuidv4()}`;
    await db.insert(schema.jobs).values({
      id: jobId,
      version: 1,
      orgId: orgId,
      generatedName: title,
      generatedDescription: description,
      userInput: {
        source: message.platform as any,
        prompt: taskDescription,
        sourceMetadata: {
          channelId: message.channelId,
          threadId: message.threadId || message.id,
          threadTimestamp: message.timestamp,
          fileIds: fileIds.length > 0 ? fileIds : undefined,
        } as any,
      },
      repos: repo ? [repo] : null,
      createdBy: message.userName || userId,
      updatedBy: message.userName || userId,
      status: 'queued',
      priority: priority || 'medium',
      queueType: 'backlog',
      orderInQueue: nextBacklogPosition,
    });

    return {
      success: true,
      jobId,
      priority: priority || 'medium',
      queueType: 'backlog',
      hasFiles: fileIds.length > 0,
      fileCount: fileIds.length,
      message: `Task added successfully`,
    };
  }

  private async checkStatus(jobIdOrSearchText: string, orgId: string) {
    // Check if input is a job ID (must start with "job-")
    const isJobId = jobIdOrSearchText.startsWith('job-');

    let jobResult;

    if (isJobId) {
      // Direct job ID lookup
      jobResult = await db
        .select()
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.id, jobIdOrSearchText),
            eq(schema.jobs.orgId, orgId)
          )
        )
        .orderBy(desc(schema.jobs.version))
        .limit(1);
    } else {
      // Text search in name, description, and userInput.prompt using ILIKE (case-insensitive pattern matching)
      const searchPattern = `%${jobIdOrSearchText}%`;

      jobResult = await db
        .select()
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.orgId, orgId),
            or(
              ilike(schema.jobs.generatedName, searchPattern),
              ilike(schema.jobs.generatedDescription, searchPattern),
              // Also search in userInput.prompt field using JSONB path query
              sql`${schema.jobs.userInput}->>'prompt' ILIKE ${searchPattern}`
            )
          )
        )
        .orderBy(desc(schema.jobs.version))
        .limit(10); // Return multiple matches for text search
    }

    if (jobResult.length === 0) {
      return {
        error: true,
        message: isJobId
          ? `Job ${jobIdOrSearchText} not found`
          : `No jobs found matching "${jobIdOrSearchText}"`,
      };
    }

    // If text search returned multiple results, return the first one (most recent)
    const job = jobResult[0];

    // If multiple matches found, log it
    if (!isJobId && jobResult.length > 1) {
      this.logger?.info(
        {
          searchText: jobIdOrSearchText,
          matchesFound: jobResult.length,
          selectedJobId: job.id,
        },
        'Multiple job matches found, using most recent'
      );
    }

    // Get recent logs from job
    const jobWithLogs = await db
      .select({
        codeGenerationLogs: schema.jobs.codeGenerationLogs,
        codeVerificationLogs: schema.jobs.codeVerificationLogs,
      })
      .from(schema.jobs)
      .where(
        and(eq(schema.jobs.id, job.id), eq(schema.jobs.version, job.version))
      )
      .limit(1);

    // Combine and get recent logs
    const allLogs: Array<{
      level: string;
      timestamp: string;
      message: string;
    }> = [];

    if (jobWithLogs[0]) {
      if (Array.isArray(jobWithLogs[0].codeGenerationLogs)) {
        allLogs.push(...jobWithLogs[0].codeGenerationLogs);
      }
      if (Array.isArray(jobWithLogs[0].codeVerificationLogs)) {
        allLogs.push(...jobWithLogs[0].codeVerificationLogs);
      }
    }

    // Sort by timestamp and get most recent 5
    allLogs.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const logs = allLogs.slice(0, 5);

    // Generate job link
    const frontendUrl = process.env.FRONT_END_URL || '';
    const jobLink = frontendUrl ? `${frontendUrl}/jobs/${job.id}` : null;

    return {
      success: true,
      job: {
        id: job.id,
        status: job.status,
        priority: job.priority,
        queuePosition: job.status === 'queued' ? job.orderInQueue : undefined,
        generatedName: job.generatedName,
        prLink: job.prLink,
        createdAt: job.createdAt,
        link: jobLink,
      },
      logs: logs.map(log => ({
        message: log.message,
        timestamp: log.timestamp,
      })),
      // Include match info for text searches
      ...(isJobId
        ? {}
        : {
            searchInfo: {
              searchText: jobIdOrSearchText,
              totalMatches: jobResult.length,
              ...(jobResult.length > 1
                ? {
                    otherMatches: jobResult
                      .slice(1, 5)
                      .map(j => ({ id: j.id, name: j.generatedName })),
                  }
                : {}),
            },
          }),
    };
  }

  private async cancelTask(jobId: string, orgId: string, userId: string) {
    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (jobResult.length === 0) {
      return {
        error: true,
        message: `Job ${jobId} not found`,
      };
    }

    const job = jobResult[0];

    // Check if job can be cancelled
    if (job.status === 'completed') {
      return {
        error: true,
        message: `Job ${jobId} is already completed`,
      };
    }

    if (job.status === 'archived') {
      return {
        error: true,
        message: `Job ${jobId} is already archived`,
      };
    }

    // Cancel if executing
    const wasExecuting = jobExecutionService.isExecuting(jobId);
    if (wasExecuting) {
      jobExecutionService.cancelJob(jobId);
    }

    // If job was queued, remove from queue and reprioritize
    if (job.status === 'queued' && job.queueType) {
      await db
        .update(schema.jobs)
        .set({
          orderInQueue: sql`${schema.jobs.orderInQueue} - 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.jobs.orgId, orgId),
            eq(schema.jobs.status, 'queued'),
            eq(schema.jobs.queueType, job.queueType),
            gt(schema.jobs.orderInQueue, job.orderInQueue)
          )
        );
    }

    // Update job status
    await db
      .update(schema.jobs)
      .set({
        status: 'archived',
        queueType: null,
        orderInQueue: -1,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      .where(
        and(
          eq(schema.jobs.id, jobId),
          eq(schema.jobs.version, job.version),
          eq(schema.jobs.orgId, orgId)
        )
      );

    return {
      success: true,
      jobId,
      previousStatus: job.status,
      wasExecuting,
      message: `Job ${jobId} cancelled successfully`,
    };
  }

  private async reprioritizeTask(
    jobId: string,
    newPriority: 'low' | 'medium' | 'high' | undefined,
    newPosition: number | undefined,
    orgId: string,
    userId: string
  ) {
    if (!newPriority && newPosition === undefined) {
      return {
        error: true,
        message: 'Either newPriority or newPosition must be provided',
      };
    }

    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (jobResult.length === 0) {
      return {
        error: true,
        message: `Job ${jobId} not found`,
      };
    }

    const job = jobResult[0];

    // Validate job is in a queue if position is being changed
    if (
      newPosition !== undefined &&
      (job.status !== 'queued' || !job.queueType)
    ) {
      return {
        error: true,
        message: `Job ${jobId} is not in a queue (current status: ${job.status})`,
      };
    }

    const updates: Partial<typeof job> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    if (newPriority) {
      updates.priority = newPriority;
    }

    if (newPosition !== undefined) {
      updates.orderInQueue = newPosition;
    }

    // Update other jobs' positions in the SAME queue if position changed
    if (
      newPosition !== undefined &&
      newPosition !== job.orderInQueue &&
      job.queueType
    ) {
      const oldPosition = job.orderInQueue;
      const queueType = job.queueType;

      if (newPosition < oldPosition) {
        // Moving up in queue
        await db
          .update(schema.jobs)
          .set({
            orderInQueue: sql`${schema.jobs.orderInQueue} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.jobs.orgId, orgId),
              eq(schema.jobs.status, 'queued'),
              eq(schema.jobs.queueType, queueType),
              gte(schema.jobs.orderInQueue, newPosition),
              lt(schema.jobs.orderInQueue, oldPosition)
            )
          );
      } else {
        // Moving down in queue
        await db
          .update(schema.jobs)
          .set({
            orderInQueue: sql`${schema.jobs.orderInQueue} - 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.jobs.orgId, orgId),
              eq(schema.jobs.status, 'queued'),
              eq(schema.jobs.queueType, queueType),
              gt(schema.jobs.orderInQueue, oldPosition),
              lte(schema.jobs.orderInQueue, newPosition)
            )
          );
      }
    }

    // Update job
    await db
      .update(schema.jobs)
      .set(updates)
      .where(
        and(
          eq(schema.jobs.id, jobId),
          eq(schema.jobs.version, job.version),
          eq(schema.jobs.orgId, orgId)
        )
      );

    const changes = [];
    if (newPriority) {
      changes.push(`Priority: ${job.priority} → ${newPriority}`);
    }
    if (newPosition !== undefined) {
      changes.push(`Queue position: ${job.orderInQueue} → ${newPosition}`);
    }

    return {
      success: true,
      jobId,
      newPriority,
      newPosition,
      changes: changes.join(', '),
      message: `Job ${jobId} reprioritized successfully`,
    };
  }

  private async pauseExecution(jobId: string, orgId: string) {
    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (jobResult.length === 0) {
      return {
        error: true,
        message: `Job ${jobId} not found`,
      };
    }

    const job = jobResult[0];

    if (job.status !== 'in-progress') {
      return {
        error: true,
        message: `Job ${jobId} is not running (current status: ${job.status})`,
      };
    }

    if (!jobExecutionService.isExecuting(jobId)) {
      return {
        error: true,
        message: `Job ${jobId} is not actively executing`,
      };
    }

    jobExecutionService.pauseJob(jobId);

    return {
      success: true,
      jobId,
      message: `Job ${jobId} paused successfully`,
    };
  }

  private async resumeExecution(jobId: string, orgId: string) {
    const jobResult = await db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, jobId), eq(schema.jobs.orgId, orgId)))
      .orderBy(desc(schema.jobs.version))
      .limit(1);

    if (jobResult.length === 0) {
      return {
        error: true,
        message: `Job ${jobId} not found`,
      };
    }

    if (!jobExecutionService.isPaused(jobId)) {
      return {
        error: true,
        message: `Job ${jobId} is not paused`,
      };
    }

    jobExecutionService.resumeJob(jobId);

    return {
      success: true,
      jobId,
      message: `Job ${jobId} resumed successfully`,
    };
  }

  private async listExecutingTasks(orgId: string) {
    const executingJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.status, 'in-progress'))
      )
      .orderBy(desc(schema.jobs.updatedAt))
      .limit(20);

    if (executingJobs.length === 0) {
      return {
        success: true,
        jobs: [],
        count: 0,
        message: 'No tasks are currently executing',
      };
    }

    return {
      success: true,
      jobs: executingJobs.map(job => ({
        jobId: job.id,
        name: job.generatedName || job.id,
        description: job.generatedDescription || null,
        status: job.status,
        priority: job.priority,
        repos: job.repos || null,
        orderInQueue: job.orderInQueue,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        version: job.version,
      })),
      count: executingJobs.length,
      message: `Found ${executingJobs.length} task(s) currently executing`,
    };
  }

  private async listQueuedTasks(orgId: string) {
    const queuedJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.status, 'queued'))
      )
      .orderBy(asc(schema.jobs.orderInQueue))
      .limit(20);

    if (queuedJobs.length === 0) {
      return {
        success: true,
        jobs: [],
        count: 0,
        message: 'No tasks are currently in the queue',
      };
    }

    return {
      success: true,
      jobs: queuedJobs.map(job => ({
        jobId: job.id,
        name: job.generatedName || job.id,
        description: job.generatedDescription || null,
        status: job.status,
        priority: job.priority,
        repos: job.repos || null,
        orderInQueue: job.orderInQueue,
        queueType: job.queueType,
        createdAt: job.createdAt,
        version: job.version,
      })),
      count: queuedJobs.length,
      message: `Found ${queuedJobs.length} task(s) in queue`,
    };
  }

  private async listCompletedTasks(orgId: string) {
    const completedJobs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.status, 'completed'))
      )
      .orderBy(desc(schema.jobs.updatedAt))
      .limit(20);

    if (completedJobs.length === 0) {
      return {
        success: true,
        jobs: [],
        count: 0,
        message: 'No tasks have been completed yet',
      };
    }

    return {
      success: true,
      jobs: completedJobs.map(job => ({
        jobId: job.id,
        name: job.generatedName || job.id,
        description: job.generatedDescription || null,
        status: job.status,
        priority: job.priority,
        repos: job.repos || null,
        createdAt: job.createdAt,
        completedAt: job.updatedAt,
        prLink: job.prLink || null,
        version: job.version,
      })),
      count: completedJobs.length,
      message: `Found ${completedJobs.length} completed task(s)`,
    };
  }

  private async listPRReviews(orgId: string) {
    const jobsWithPRs = await db
      .select()
      .from(schema.jobs)
      .where(
        and(eq(schema.jobs.orgId, orgId), eq(schema.jobs.status, 'in-review'))
      )
      .limit(10);

    if (jobsWithPRs.length === 0) {
      return {
        success: true,
        prs: [],
        message: 'No PRs waiting for review',
      };
    }

    return {
      success: true,
      prs: jobsWithPRs.map(job => ({
        jobId: job.id,
        name: job.generatedName || job.id,
        prLink: job.prLink,
      })),
      count: jobsWithPRs.length,
      message: `Found ${jobsWithPRs.length} PR(s) waiting for review`,
    };
  }

  private async getJobLink(jobIdOrSearchText: string, orgId: string) {
    // Check if input is a job ID (must start with "job-")
    const isJobId = jobIdOrSearchText.startsWith('job-');
    let jobResult;

    if (isJobId) {
      // Direct job ID lookup
      jobResult = await db
        .select()
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.id, jobIdOrSearchText),
            eq(schema.jobs.orgId, orgId)
          )
        )
        .orderBy(desc(schema.jobs.version))
        .limit(1);
    } else {
      // Text search in name and description using ILIKE (case-insensitive pattern matching)
      const searchPattern = `%${jobIdOrSearchText}%`;

      jobResult = await db
        .select()
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.orgId, orgId),
            or(
              ilike(schema.jobs.generatedName, searchPattern),
              ilike(schema.jobs.generatedDescription, searchPattern),
              // Also search in userInput.prompt field using JSONB path query
              sql`${schema.jobs.userInput}->>'prompt' ILIKE ${searchPattern}`
            )
          )
        )
        .orderBy(desc(schema.jobs.version))
        .limit(10);
    }

    if (jobResult.length === 0) {
      return {
        error: true,
        message: isJobId
          ? `Job ${jobIdOrSearchText} not found`
          : `No jobs found matching "${jobIdOrSearchText}"`,
      };
    }

    // If text search returned multiple results, return the first one (most recent)
    const job = jobResult[0];

    // Generate job link
    const frontendUrl = process.env.FRONT_END_URL || '';
    const jobLink = frontendUrl ? `${frontendUrl}/jobs/${job.id}` : null;

    if (!jobLink) {
      return {
        error: true,
        message:
          'Frontend URL is not configured. Please set FRONT_END_URL environment variable.',
      };
    }

    return {
      success: true,
      jobId: job.id,
      jobName: job.generatedName || job.id,
      link: jobLink,
      message: `Job link for "${job.generatedName || job.id}"`,
      ...(isJobId
        ? {}
        : {
            searchInfo: {
              searchText: jobIdOrSearchText,
              totalMatches: jobResult.length,
            },
          }),
    };
  }

  // ========== Helper Methods ==========

  private async processAttachments(
    attachments: any[],
    orgId: string,
    userId: string
  ): Promise<string[]> {
    if (attachments.length > MAX_FILES_PER_JOB) {
      throw new Error(`Maximum ${MAX_FILES_PER_JOB} files allowed per job`);
    }

    const currentUsage = await gcsStorage.getOrgStorageUsage(orgId);
    const maxStorageBytes = MAX_TOTAL_STORAGE_MB * 1024 * 1024;

    if (currentUsage >= maxStorageBytes) {
      throw new Error(`Storage limit of ${MAX_TOTAL_STORAGE_MB}MB exceeded`);
    }

    const fileIds: string[] = [];

    for (const attachment of attachments) {
      const fileSizeBytes = attachment.size || 0;
      const maxFileSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (fileSizeBytes > maxFileSizeBytes) {
        throw new Error(
          `File ${attachment.fileName} exceeds ${MAX_FILE_SIZE_MB}MB limit`
        );
      }

      if (!attachment.localPath) {
        continue;
      }

      const fileBuffer = fs.readFileSync(attachment.localPath);

      const stored = await gcsStorage.uploadFile(fileBuffer, {
        fileName: attachment.fileName || 'unnamed',
        mimeType: attachment.mimeType,
        size: fileSizeBytes,
        orgId: orgId,
        uploadedBy: userId,
      });

      const fileId = uuidv4();
      await db.insert(schema.files).values({
        id: fileId,
        orgId: orgId,
        fileName: attachment.fileName || 'unnamed',
        mimeType: attachment.mimeType || 'application/octet-stream',
        size: fileSizeBytes,
        gcsPath: stored.gcsPath,
        uploadedBy: userId,
      });

      fileIds.push(fileId);
      fs.unlinkSync(attachment.localPath);
    }

    return fileIds;
  }

  private getStatusEmoji(status: string): string {
    const emojiMap: Record<string, string> = {
      queued: '⏳',
      'in-progress': '🔄',
      completed: '✅',
      failed: '❌',
      archived: '📦',
    };
    return emojiMap[status] || '📋';
  }
}

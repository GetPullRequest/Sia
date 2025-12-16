import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const model = openai(process.env.OPENAI_RESPONSE_MODEL || 'gpt-4o-mini');

export interface ExtractedCommands {
  setupCommands: string[];
  buildCommands: string[];
  testCommands: string[];
  description?: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Extract setup, build, and test commands from README/CONTRIBUTING using LLM
 * Uses GPT-4o-mini to intelligently parse documentation and extract relevant commands
 */
export async function extractCommandsFromReadme(
  readmeContent: string,
  contributingContent?: string
): Promise<ExtractedCommands> {
  try {
    const combinedContent = contributingContent
      ? `# README.md\n\n${readmeContent}\n\n# CONTRIBUTING.md\n\n${contributingContent}`
      : readmeContent;

    // Truncate if too long (keep first 16000 chars to stay within token limits)
    const truncatedContent =
      combinedContent.length > 16000
        ? combinedContent.substring(0, 16000) +
          '\n\n[... content truncated ...]'
        : combinedContent;

    const result = await generateText({
      model,
      system: `Extract setup, build, test commands and repository description from README/CONTRIBUTING documentation.

Setup commands: Only runtime/version installation commands (nvm, pyenv, sdk). Exclude git clone and dependency installation.
Build commands: Return dependency installation and build commands as separate strings in execution order. Do not chain with &&.
Test commands: Extract 1-2 primary test commands.
Description: Extract or synthesize a 1-3 sentence repository description from README/CONTRIBUTING.

Return only executable shell commands without prompts ($, >) or comments. Use empty arrays if no commands found.`,
      messages: [
        {
          role: 'user',
          content: `Extract the setup, build, and test commands, plus repository description from this documentation:

${truncatedContent}

Return your response in this exact JSON format:
{
  "setupCommands": [],
  "buildCommands": [],
  "testCommands": [],
  "description": ""
}

Important: Return ONLY the JSON, no markdown formatting or additional text.`,
        },
      ],
    });

    // Parse JSON response
    const text = result.text.trim();
    let parsed: {
      setupCommands: string[];
      buildCommands: string[];
      testCommands: string[];
      description?: string;
    };

    // Extract JSON from markdown code blocks if present
    const jsonMatch =
      text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
      text.match(/(\{[\s\S]*\})/);

    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      // Try parsing the whole response as JSON
      parsed = JSON.parse(text);
    }

    // Validate and clean commands
    const setupCommands = cleanCommands(parsed.setupCommands || []).filter(
      cmd => !cmd.includes('git clone') && !cmd.includes('clone')
    );
    // Split any chained build commands (safety check in case LLM doesn't follow instructions)
    const buildCommands = cleanCommands(parsed.buildCommands || []).flatMap(
      cmd =>
        cmd
          .split(/\s+&&\s+/)
          .map(c => c.trim())
          .filter(Boolean)
    );
    const testCommands = cleanCommands(parsed.testCommands || []);

    // Clean and validate description
    const description = parsed.description
      ? parsed.description.trim().replace(/\n+/g, ' ').substring(0, 500)
      : undefined;

    // Limit test commands to 1-2
    const limitedTestCommands = testCommands.slice(0, 2);

    // Determine confidence based on number of commands found
    const totalCommands =
      setupCommands.length + buildCommands.length + limitedTestCommands.length;
    const confidence: 'high' | 'medium' | 'low' =
      totalCommands >= 3 ? 'high' : totalCommands >= 1 ? 'medium' : 'low';

    return {
      setupCommands,
      buildCommands,
      testCommands: limitedTestCommands,
      description,
      confidence,
    };
  } catch (error) {
    console.warn('LLM command extraction failed:', error);
    // Return empty result on error (caller should fall back to pattern matching)
    return {
      setupCommands: [],
      buildCommands: [],
      testCommands: [],
      description: undefined,
      confidence: 'low',
    };
  }
}

/**
 * Clean and validate commands
 * Removes shell prompts, empty strings, and obviously invalid commands
 */
function cleanCommands(commands: string[]): string[] {
  return commands
    .map(cmd => {
      // Remove shell prompt indicators
      let cleaned = cmd.trim().replace(/^[$>]\s*/, '');
      // Remove surrounding quotes if present
      cleaned = cleaned.replace(/^["']|["']$/g, '');
      return cleaned;
    })
    .filter(cmd => {
      // Filter out empty or invalid commands
      if (!cmd || cmd.length < 2) return false;
      // Filter out comments
      if (cmd.startsWith('#')) return false;
      // Filter out URLs
      if (cmd.startsWith('http://') || cmd.startsWith('https://')) return false;
      // Filter out markdown
      if (cmd.startsWith('#') || cmd.startsWith('*')) return false;
      return true;
    });
}

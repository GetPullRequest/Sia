import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const model = openai(process.env.OPENAI_RESPONSE_MODEL || 'gpt-4o-mini');

export interface ExtractedCommands {
  setupCommands: string[];
  buildCommands: string[];
  testCommands: string[];
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

    // Truncate if too long (keep first 8000 chars to stay within token limits)
    const truncatedContent =
      combinedContent.length > 8000
        ? combinedContent.substring(0, 8000) + '\n\n[... content truncated ...]'
        : combinedContent;

    const result = await generateText({
      model,
      system: `You are a technical assistant that extracts setup, build, and test commands from repository documentation.

Your task is to read README and CONTRIBUTING files and identify:
1. **Setup commands**: Commands needed to install dependencies (npm install, pip install, etc.)
2. **Build commands**: Commands to build/compile the project (npm run build, make, etc.)
3. **Test commands**: Commands to run tests (npm test, pytest, cargo test, etc.)

Rules:
- Extract actual shell commands, not descriptions
- Remove shell prompt indicators like $ or >
- Keep commands concise and executable
- If multiple commands serve the same purpose, choose the most common/standard one
- If no commands are found for a category, return an empty array
- Do not include comments or explanations in commands`,
      messages: [
        {
          role: 'user',
          content: `Extract the setup, build, and test commands from this repository documentation:

${truncatedContent}

Return your response in this exact JSON format:
{
  "setupCommands": ["command1", "command2"],
  "buildCommands": ["command1"],
  "testCommands": ["command1", "command2"]
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
    const setupCommands = cleanCommands(parsed.setupCommands || []);
    const buildCommands = cleanCommands(parsed.buildCommands || []);
    const testCommands = cleanCommands(parsed.testCommands || []);

    // Determine confidence based on number of commands found
    const totalCommands =
      setupCommands.length + buildCommands.length + testCommands.length;
    const confidence: 'high' | 'medium' | 'low' =
      totalCommands >= 3 ? 'medium' : totalCommands >= 1 ? 'medium' : 'low';

    return {
      setupCommands,
      buildCommands,
      testCommands,
      confidence,
    };
  } catch (error) {
    console.warn('LLM command extraction failed:', error);
    // Return empty result on error (caller should fall back to pattern matching)
    return {
      setupCommands: [],
      buildCommands: [],
      testCommands: [],
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

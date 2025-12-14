import * as fs from 'fs/promises';
import * as path from 'path';
import type { LanguageDetector, DetectedConfig } from './types.js';

/**
 * Detector that parses README.md and CONTRIBUTING.md for setup/build/test commands
 * Uses pattern matching to identify command blocks under relevant headers
 */
export class ReadmeDetector implements LanguageDetector {
  // Headers that typically contain setup instructions
  private readonly setupHeaders = [
    /^##?\s*(setup|installation|getting\s*started|prerequisites)/i,
    /^##?\s*install/i,
  ];

  // Headers that typically contain build instructions
  private readonly buildHeaders = [
    /^##?\s*(build|building|compile|compilation)/i,
    /^##?\s*development/i,
  ];

  // Headers that typically contain test instructions
  private readonly testHeaders = [
    /^##?\s*(test|testing|running\s*tests)/i,
    /^##?\s*validation/i,
  ];

  async canDetect(repoPath: string): Promise<boolean> {
    try {
      const readmePath = path.join(repoPath, 'README.md');
      await fs.access(readmePath);
      return true;
    } catch {
      return false;
    }
  }

  async detect(repoPath: string): Promise<DetectedConfig> {
    const readmePath = path.join(repoPath, 'README.md');
    const contributingPath = path.join(repoPath, 'CONTRIBUTING.md');

    // Read README.md (required)
    const readmeContent = await fs.readFile(readmePath, 'utf-8');

    // Read CONTRIBUTING.md (optional)
    let contributingContent = '';
    try {
      contributingContent = await fs.readFile(contributingPath, 'utf-8');
    } catch {
      // CONTRIBUTING.md not found, continue with README only
    }

    // Combine both documents
    const combinedContent = `${readmeContent}\n\n${contributingContent}`;

    // Extract commands from sections
    const setupCommands = this.extractCommands(
      combinedContent,
      this.setupHeaders
    );
    const buildCommands = this.extractCommands(
      combinedContent,
      this.buildHeaders
    );
    const testCommands = this.extractCommands(
      combinedContent,
      this.testHeaders
    );

    // Determine confidence based on how many commands we found
    const totalCommands =
      setupCommands.length + buildCommands.length + testCommands.length;
    const confidence =
      totalCommands > 3 ? 'medium' : totalCommands > 0 ? 'low' : 'low';

    const detectedFrom = contributingContent
      ? 'README.md, CONTRIBUTING.md'
      : 'README.md';

    return {
      executionStrategy: 'custom',
      setupCommands,
      buildCommands,
      testCommands,
      detectedLanguage: 'markdown',
      detectedFrom,
      confidence,
    };
  }

  /**
   * Extract commands from markdown content under specific headers
   */
  private extractCommands(content: string, headerPatterns: RegExp[]): string[] {
    const commands: string[] = [];
    const lines = content.split('\n');

    let inRelevantSection = false;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if we're entering a relevant section
      const isRelevantHeader = headerPatterns.some(pattern =>
        pattern.test(line)
      );
      if (isRelevantHeader) {
        inRelevantSection = true;
        continue;
      }

      // Check if we're leaving the section (new header)
      if (inRelevantSection && /^##?\s+/.test(line)) {
        // Process any remaining code block
        if (inCodeBlock && codeBlockContent.length > 0) {
          commands.push(...this.processCodeBlock(codeBlockContent));
          codeBlockContent = [];
        }
        inRelevantSection = false;
        inCodeBlock = false;
        continue;
      }

      if (!inRelevantSection) continue;

      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          commands.push(...this.processCodeBlock(codeBlockContent));
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
      } else {
        // Check for inline commands (lines starting with $, npm, pip, etc.)
        const inlineCommand = this.extractInlineCommand(line);
        if (inlineCommand) {
          commands.push(inlineCommand);
        }
      }
    }

    // Remove duplicates while preserving order
    return [...new Set(commands)].filter(cmd => cmd && cmd.trim().length > 0);
  }

  /**
   * Process commands from a code block
   */
  private processCodeBlock(lines: string[]): string[] {
    const commands: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Remove leading $ or > (common shell prompt indicators)
      const cleaned = trimmed.replace(/^[$>]\s*/, '');

      if (cleaned && this.looksLikeCommand(cleaned)) {
        commands.push(cleaned);
      }
    }

    return commands;
  }

  /**
   * Extract command from inline markdown (e.g., lines starting with npm, pip, etc.)
   */
  private extractInlineCommand(line: string): string | null {
    // Remove markdown formatting
    const cleaned = line.replace(/`/g, '').trim();

    // Check if line starts with a command indicator
    const commandIndicators = [
      /^npm\s+/,
      /^yarn\s+/,
      /^pnpm\s+/,
      /^pip\s+/,
      /^python\s+/,
      /^cargo\s+/,
      /^go\s+/,
      /^make\s*/,
      /^docker\s+/,
      /^docker-compose\s+/,
    ];

    const matchesIndicator = commandIndicators.some(pattern =>
      pattern.test(cleaned)
    );

    if (matchesIndicator && this.looksLikeCommand(cleaned)) {
      return cleaned.replace(/^[$>]\s*/, ''); // Remove shell prompts if present
    }

    return null;
  }

  /**
   * Heuristic to determine if a string looks like a valid command
   */
  private looksLikeCommand(str: string): boolean {
    // Must have some content
    if (!str || str.length < 3) return false;

    // Shouldn't be a markdown heading
    if (str.startsWith('#')) return false;

    // Shouldn't be a URL
    if (str.startsWith('http://') || str.startsWith('https://')) return false;

    // Should contain at least one space or be a single word command
    const words = str.split(/\s+/);
    if (words.length === 0) return false;

    // First word should be a reasonable command length
    const firstWord = words[0];
    if (firstWord.length > 50) return false;

    // Common command patterns
    const commonCommands = [
      'npm',
      'yarn',
      'pnpm',
      'pip',
      'python',
      'cargo',
      'go',
      'make',
      'docker',
      'docker-compose',
      'node',
      'mvn',
      'gradle',
      'bundle',
      'gem',
      'composer',
    ];

    return commonCommands.includes(firstWord.toLowerCase());
  }
}

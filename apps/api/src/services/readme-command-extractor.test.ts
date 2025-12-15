import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { extractCommandsFromReadme } from './readme-command-extractor.js';
import { generateText } from 'ai';

// Mock the AI SDK
jest.mock('ai', () => ({
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/openai', () => ({
  openai: jest.fn(() => 'mocked-model'),
}));

const mockedGenerateText = generateText as jest.MockedFunction<
  typeof generateText
>;

describe('readme-command-extractor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('extractCommandsFromReadme', () => {
    it('should extract commands from a typical Node.js README', async () => {
      const readme = `
# My Project

## Installation

\`\`\`bash
npm install
\`\`\`

## Building

\`\`\`bash
npm run build
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`
      `;

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install'],
          buildCommands: ['npm run build'],
          testCommands: ['npm test'],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install']);
      expect(result.buildCommands).toEqual(['npm run build']);
      expect(result.testCommands).toEqual(['npm test']);
      expect(result.confidence).toBe('medium');
      expect(mockedGenerateText).toHaveBeenCalledTimes(1);
    });

    it('should extract commands from Python project README', async () => {
      const readme = `
# Python Project

## Setup

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Running Tests

\`\`\`bash
pytest
\`\`\`
      `;

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['pip install -r requirements.txt'],
          buildCommands: [],
          testCommands: ['pytest'],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['pip install -r requirements.txt']);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual(['pytest']);
      expect(result.confidence).toBe('medium');
    });

    it('should handle markdown-wrapped JSON response', async () => {
      const readme = '# Test Project';

      mockedGenerateText.mockResolvedValue({
        text: '```json\n{"setupCommands":["npm install"],"buildCommands":[],"testCommands":[]}\n```',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install']);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual([]);
    });

    it('should clean commands by removing shell prompts', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['$ npm install', '> yarn install'],
          buildCommands: ['$ npm run build'],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install', 'yarn install']);
      expect(result.buildCommands).toEqual(['npm run build']);
    });

    it('should filter out invalid commands', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: [
            'npm install',
            '', // Empty
            '#comment', // Comment
            'https://example.com', // URL
            'a', // Too short
          ],
          buildCommands: ['npm run build'],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install']);
      expect(result.buildCommands).toEqual(['npm run build']);
    });

    it('should combine README and CONTRIBUTING content', async () => {
      const readme = '# Main README';
      const contributing = '# CONTRIBUTING GUIDE';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install'],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      await extractCommandsFromReadme(readme, contributing);

      const callArg = mockedGenerateText.mock.calls[0][0] as any;
      expect(callArg.messages[0].content).toContain('# README.md');
      expect(callArg.messages[0].content).toContain('# CONTRIBUTING.md');
      expect(callArg.messages[0].content).toContain('Main README');
      expect(callArg.messages[0].content).toContain('CONTRIBUTING GUIDE');
    });

    it('should truncate long content to 8000 characters', async () => {
      const longReadme = 'x'.repeat(10000);

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: [],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      await extractCommandsFromReadme(longReadme);

      const callArg = mockedGenerateText.mock.calls[0][0] as any;
      const content = callArg.messages[0].content as string;
      // Check that content is truncated (includes prompt text + truncated content)
      expect(content).toContain('[... content truncated ...]');
      // Original content was 10000 chars, should be truncated to around 8000 + prompt overhead
      expect(content.length).toBeLessThan(9000);
    });

    it('should assign medium confidence when multiple commands found', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install'],
          buildCommands: ['npm run build'],
          testCommands: ['npm test'],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.confidence).toBe('medium');
    });

    it('should assign medium confidence when some commands found', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install'],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.confidence).toBe('medium');
    });

    it('should assign low confidence when no commands found', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: [],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual([]);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual([]);
      expect(result.confidence).toBe('low');
    });

    it('should handle LLM errors gracefully and return empty result', async () => {
      const readme = '# Test';
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Empty implementation for test
        });

      mockedGenerateText.mockRejectedValue(new Error('API Error'));

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual([]);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual([]);
      expect(result.confidence).toBe('low');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLM command extraction failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle malformed JSON response', async () => {
      const readme = '# Test';
      const consoleWarnSpy = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          // Empty implementation for test
        });

      mockedGenerateText.mockResolvedValue({
        text: 'This is not valid JSON',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual([]);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual([]);
      expect(result.confidence).toBe('low');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'LLM command extraction failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle partial JSON response', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install'],
          // Missing buildCommands and testCommands
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install']);
      expect(result.buildCommands).toEqual([]);
      expect(result.testCommands).toEqual([]);
    });

    it('should remove surrounding quotes from commands', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['"npm install"', "'yarn install'"],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual(['npm install', 'yarn install']);
    });

    it('should handle complex multi-step setup commands', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: ['npm install', 'npm run db:migrate', 'npm run seed'],
          buildCommands: ['npm run build'],
          testCommands: ['npm run test:unit', 'npm run test:e2e'],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      const result = await extractCommandsFromReadme(readme);

      expect(result.setupCommands).toEqual([
        'npm install',
        'npm run db:migrate',
        'npm run seed',
      ]);
      expect(result.buildCommands).toEqual(['npm run build']);
      expect(result.testCommands).toEqual([
        'npm run test:unit',
        'npm run test:e2e',
      ]);
      expect(result.confidence).toBe('medium');
    });

    it('should use correct model and system prompt', async () => {
      const readme = '# Test';

      mockedGenerateText.mockResolvedValue({
        text: JSON.stringify({
          setupCommands: [],
          buildCommands: [],
          testCommands: [],
        }),
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 50 },
      } as any);

      await extractCommandsFromReadme(readme);

      const callArg = mockedGenerateText.mock.calls[0][0] as any;
      expect(callArg.model).toBe('mocked-model');
      expect(callArg.system).toContain('setup, build, and test commands');
      expect(callArg.messages[0].role).toBe('user');
    });
  });
});

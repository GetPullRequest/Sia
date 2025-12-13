import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

const model = openai(process.env.OPENAI_RESPONSE_MODEL || 'gpt-4o-mini');

/**
 * Generate a concise title and description from task description using LLM
 */
export async function generateJobTitleAndDescription(
  taskDescription: string
): Promise<{ title: string; description: string }> {
  try {
    const result = await generateText({
      model,
      system:
        'You are a helpful assistant that generates concise, descriptive titles and descriptions for development tasks. Generate a short title (max 60 characters) and a brief description (max 200 characters) based on the task description provided.',
      messages: [
        {
          role: 'user',
          content: `Generate a title and description for this task: ${taskDescription}

Return your response in this exact JSON format:
{
  "title": "Short descriptive title (max 60 chars)",
  "description": "Brief description (max 200 chars)"
}`,
        },
      ],
    });

    // Try to parse JSON from the response
    const text = result.text.trim();
    let parsed: { title: string; description: string };

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

    return {
      title: parsed.title || taskDescription.substring(0, 60),
      description: parsed.description || taskDescription.substring(0, 200),
    };
  } catch (error) {
    console.warn(
      'Failed to generate job title/description, using fallback:',
      error
    );
    // Fallback: use first 60 chars for title, first 200 for description
    return {
      title: taskDescription.substring(0, 60),
      description: taskDescription.substring(0, 200),
    };
  }
}

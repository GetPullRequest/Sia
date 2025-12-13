import { marked } from 'marked';

/**
 * Converts markdown to HTML with proper styling and left alignment
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  // Simple markdown to HTML conversion
  let html = marked(markdown, {
    gfm: true,
    breaks: true,
  });

  // Post-process the HTML to add proper styling
  html = html
    .replace(/<p>/g, '<p class="mb-3 text-white/80 leading-relaxed">')
    .replace(/<h1>/g, '<h1 class="font-bold mb-4 mt-8 text-white text-3xl">')
    .replace(/<h2>/g, '<h2 class="font-bold mb-3 mt-6 text-blue-300 text-2xl">')
    .replace(/<h3>/g, '<h3 class="font-bold mb-3 mt-5 text-blue-200 text-xl">')
    .replace(/<h4>/g, '<h4 class="font-bold mb-2 mt-4 text-gray-300 text-lg">')
    .replace(/<h5>/g, '<h5 class="font-bold mb-2 mt-4 text-gray-300">')
    .replace(/<h6>/g, '<h6 class="font-bold mb-2 mt-4 text-gray-300">')
    .replace(/<strong>/g, '<strong class="font-bold text-white">')
    .replace(/<b>/g, '<b class="font-bold text-white">')
    .replace(/<em>/g, '<em class="italic text-blue-200">')
    .replace(/<i>/g, '<i class="italic text-blue-200">')
    .replace(
      /<blockquote>/g,
      '<blockquote class="border-l-4 border-blue-400 pl-4 italic my-4 text-blue-200 leading-relaxed">'
    )
    .replace(
      /<ul>/g,
      '<ul class="list-disc list-inside my-3 text-white/80 space-y-1">'
    )
    .replace(
      /<ol>/g,
      '<ol class="list-decimal list-inside my-3 text-white/80 space-y-1">'
    )
    .replace(/<li>/g, '<li class="text-white/80 leading-relaxed">')
    .replace(
      /<img([^>]*)>/g,
      '<img$1 class="rounded-lg shadow-lg max-w-full h-auto my-6" />'
    )
    .replace(
      /<table>/g,
      '<div class="table-scroll-container"><table class="border-collapse my-4 text-white/80 w-full">'
    )
    .replace(/<\/table>/g, '</table></div>')
    .replace(
      /<th>/g,
      '<th class="border border-gray-600 px-3 py-2 bg-gray-800 font-bold text-blue-300">'
    )
    .replace(
      /<td>/g,
      '<td class="border border-gray-600 px-3 py-2 text-white/80">'
    );

  return html;
}

/**
 * Adds IDs to headings in HTML for table of contents
 */
export function addHeadingIds(html: string): string {
  let headingIndex = 0;
  return html.replace(
    /<h([1-6])([^>]*?)>(.*?)<\/h[1-6]>/gi,
    (match: string, level: string, attributes: string, text: string) => {
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const baseId = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const id = `heading-${baseId}-${headingIndex}`;
      headingIndex++;

      // Check if ID already exists in attributes
      if (attributes.includes('id=')) {
        return match;
      }

      return `<h${level} id="${id}"${attributes}>${text}</h${level}>`;
    }
  );
}

/**
 * Calculates reading time from markdown content (rough estimate: 200 words per minute)
 */
export function calculateReadingTime(markdown: string): number {
  // Remove markdown syntax and count words
  const text = markdown
    .replace(/[#*`_~[\]()]/g, ' ')
    .replace(/!\[.*?\]\(.*?\)/g, ' ')
    .replace(/\[.*?\]\(.*?\)/g, ' ');
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.ceil(wordCount / 200);
}

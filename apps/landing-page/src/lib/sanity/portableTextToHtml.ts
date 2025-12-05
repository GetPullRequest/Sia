import type { PortableTextBlock } from '@portabletext/types'

/**
 * Converts Portable Text blocks to HTML string
 * Handles blocks, images, lists, and common marks
 */
export function portableTextToHtml(blocks: PortableTextBlock[] | null | undefined): string {
  if (!blocks || !Array.isArray(blocks)) {
    return ''
  }

  let html = ''
  let inList = false
  let listType: 'ul' | 'ol' | null = null

  blocks.forEach((block, index) => {
    if (block._type === 'block') {
      const blockData = block as any
      const children = blockData.children || []
      
      // Process text with marks
      let text = children
        .map((child: any) => {
          if (child._type === 'span') {
            let childText = child.text || ''
            
            // Apply marks (bold, italic, links, etc.)
            if (child.marks && Array.isArray(child.marks)) {
              // Process marks in reverse order to maintain proper nesting
              const marks = [...child.marks].reverse()
              marks.forEach((mark: any) => {
                if (typeof mark === 'string') {
                  if (mark === 'strong') {
                    childText = `<strong>${childText}</strong>`
                  } else if (mark === 'em') {
                    childText = `<em>${childText}</em>`
                  } else if (mark.startsWith('link-')) {
                    // Handle links by key
                    const linkData = blockData.markDefs?.find((def: any) => def._key === mark)
                    if (linkData) {
                      const href = linkData.href || linkData.url || '#'
                      childText = `<a href="${href}">${childText}</a>`
                    }
                  }
                } else if (typeof mark === 'object' && mark !== null) {
                  // Handle link objects
                  if (mark._type === 'link' || mark._key) {
                    const markKey = mark._key || mark._type
                    const linkData = blockData.markDefs?.find((def: any) => def._key === markKey) || mark
                    const href = linkData.href || linkData.url || '#'
                    childText = `<a href="${href}">${childText}</a>`
                  }
                }
              })
            }
            
            return childText
          }
          return ''
        })
        .join('')

      // Handle lists
      if (blockData.listItem) {
        const currentListType = blockData.listItem === 'number' ? 'ol' : 'ul'
        
        // Start a new list if needed
        if (!inList || listType !== currentListType) {
          // Close previous list if exists
          if (inList) {
            html += `</${listType}>`
          }
          html += `<${currentListType}>`
          inList = true
          listType = currentListType
        }
        
        html += `<li>${text}</li>`
      } else {
        // Close list if we were in one
        if (inList) {
          html += `</${listType}>`
          inList = false
          listType = null
        }
        
        // Determine the tag based on style
        const style = blockData.style || 'normal'
        let tag = 'p'
        
        if (style === 'h1') tag = 'h1'
        else if (style === 'h2') tag = 'h2'
        else if (style === 'h3') tag = 'h3'
        else if (style === 'h4') tag = 'h4'
        else if (style === 'h5') tag = 'h5'
        else if (style === 'h6') tag = 'h6'
        else if (style === 'blockquote') tag = 'blockquote'
        
        if (text.trim()) {
          html += `<${tag}>${text}</${tag}>`
        }
      }
    } else if (block._type === 'image') {
      // Close list if we were in one
      if (inList) {
        html += `</${listType}>`
        inList = false
        listType = null
      }
      
      const image = block as any
      const url = image.asset?.url || ''
      const alt = image.alt || image.caption || ''
      const caption = image.caption ? `<figcaption>${image.caption}</figcaption>` : ''
      html += `<figure><img src="${url}" alt="${alt}" />${caption}</figure>`
    }
  })
  
  // Close any remaining list
  if (inList) {
    html += `</${listType}>`
  }

  return html
}

/**
 * Adds IDs to headings in HTML for table of contents
 */
export function addHeadingIds(html: string): string {
  let headingIndex = 0
  return html.replace(
    /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi,
    (match: string, level: string, attributes: string, text: string) => {
      const cleanText = text.replace(/<[^>]*>/g, '').trim()
      const baseId = cleanText.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const id = `heading-${baseId}-${headingIndex}`
      headingIndex++
      return `<h${level}${attributes} id="${id}">${text}</h${level}>`
    }
  )
}

/**
 * Calculates reading time from HTML content (rough estimate: 200 words per minute)
 */
export function calculateReadingTime(html: string): number {
  // Remove HTML tags and count words
  const text = html.replace(/<[^>]*>/g, ' ')
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length
  return Math.ceil(wordCount / 200)
}


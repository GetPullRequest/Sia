import { client } from '../lib/sanity/client';
import { postsQuery, postQuery } from '../lib/sanity/queries';
import { urlForImage } from '../lib/sanity/image';
import { portableTextToHtml, addHeadingIds, calculateReadingTime } from '../lib/sanity/portableTextToHtml';
import type { PortableTextBlock } from '@portabletext/types';

export interface EngineeringBlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  readingTime: number;
  content: string; // HTML content for BlogContents component
  originalContent: string; // JSON string of Portable Text blocks
  body?: PortableTextBlock[]; // Portable Text blocks for PortableText component
  mainImage?: any; // Raw mainImage for image URL builder
  authorName?: string;
}

interface SanityPost {
  _id: string;
  _createdAt: string;
  title: string;
  description?: string;
  slug: {
    current: string;
  };
  mainImage?: {
    asset: {
      _ref?: string;
      _type?: string;
      url?: string;
    };
    alt?: string;
  };
  imageURL?: string;
  publishedAt?: string;
  authorName?: string;
  body?: PortableTextBlock[];
}

// Function to convert Sanity post to EngineeringBlogPost
function convertSanityPostToBlogPost(sanityPost: SanityPost): EngineeringBlogPost {
  const slug = sanityPost.slug?.current || '';
  const publishedAt = sanityPost.publishedAt || sanityPost._createdAt;
  
  // Convert Portable Text body to HTML
  let htmlContent = portableTextToHtml(sanityPost.body || []);
  
  // Add IDs to headings for table of contents
  htmlContent = addHeadingIds(htmlContent);
  
  // Calculate reading time
  const readingTime = calculateReadingTime(htmlContent);
  
  // Get image URL
  let imageUrl = '';
  if (sanityPost.imageURL) {
    imageUrl = sanityPost.imageURL;
  } else if (sanityPost.mainImage) {
    try {
      imageUrl = urlForImage(sanityPost.mainImage as any) || '';
    } catch (error) {
      console.warn('Error generating image URL:', error);
      // Fallback to direct asset URL if available
      imageUrl = (sanityPost.mainImage as any).asset?.url || '';
    }
  }
  
  // Get description
  const description = sanityPost.description || '';
  
  // Create original content representation (JSON string of Portable Text)
  const originalContent = JSON.stringify(sanityPost.body || []);

  return {
    id: sanityPost._id,
    slug,
    title: sanityPost.title,
    description,
    image: imageUrl,
    publishedAt,
    readingTime,
    content: htmlContent,
    originalContent,
    body: sanityPost.body, // Include Portable Text blocks
    mainImage: sanityPost.mainImage, // Include raw mainImage
    authorName: sanityPost.authorName,
  };
}

// Function to fetch and process engineering blog posts from Sanity (CSR)
export async function getEngineeringBlogPosts(): Promise<EngineeringBlogPost[]> {
  try {
    const sanityPosts = await client.fetch<SanityPost[]>(postsQuery);
    
    const posts = sanityPosts
      .map(convertSanityPostToBlogPost)
      .filter(post => post.slug); // Filter out posts without slugs
    
    // Posts are already sorted by publishedAt desc in the query
    return posts;
  } catch (error) {
    console.error('Error loading engineering blog posts from Sanity:', error);
    return [];
  }
}

export async function getEngineeringBlogPost(
  slug: string
): Promise<EngineeringBlogPost | null> {
  try {
    const sanityPost = await client.fetch<SanityPost | null>(postQuery, { slug });
    
    if (!sanityPost) {
      return null;
    }
    
    return convertSanityPostToBlogPost(sanityPost);
  } catch (error) {
    console.error(`Error loading engineering blog ${slug} from Sanity:`, error);
    return null;
  }
}

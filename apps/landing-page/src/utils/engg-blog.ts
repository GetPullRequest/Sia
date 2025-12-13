import { client } from '../lib/sanity/client';
import { postsQuery, postQuery } from '../lib/sanity/queries';
import { urlForImage } from '../lib/sanity/image';
import {
  portableTextToHtml,
  addHeadingIds as addHeadingIdsPortable,
  calculateReadingTime as calculateReadingTimePortable,
} from '../lib/sanity/portableTextToHtml';
import {
  markdownToHtml,
  addHeadingIds,
  calculateReadingTime,
} from '../lib/sanity/markdownToHtml';
import type { PortableTextBlock } from '@portabletext/types';

export interface Author {
  name: string;
  bio?: string | any[]; // Can be string or Portable Text blocks
  image?: any;
  imageURL?: string;
  xLink?: string;
}

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
  author?: Author;
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
  author?: {
    name: string;
    bio?: string;
    image?: any;
    imageURL?: string;
    xLink?: string;
  };
  body?: string | PortableTextBlock[]; // Can be markdown string or Portable Text blocks
}

// Function to convert Sanity post to EngineeringBlogPost
function convertSanityPostToBlogPost(
  sanityPost: SanityPost
): EngineeringBlogPost {
  const slug = sanityPost.slug?.current || '';
  const publishedAt = sanityPost.publishedAt || sanityPost._createdAt;

  let htmlContent = '';
  let readingTime = 0;
  let originalContent = '';
  let portableTextBody: PortableTextBlock[] | undefined;

  // Check if body is markdown string or Portable Text blocks
  if (typeof sanityPost.body === 'string') {
    // Process markdown content
    htmlContent = markdownToHtml(sanityPost.body);
    htmlContent = addHeadingIds(htmlContent);
    readingTime = calculateReadingTime(sanityPost.body);
    originalContent = sanityPost.body;
  } else if (Array.isArray(sanityPost.body)) {
    // Fallback to Portable Text processing
    htmlContent = portableTextToHtml(sanityPost.body);
    htmlContent = addHeadingIdsPortable(htmlContent);
    readingTime = calculateReadingTimePortable(htmlContent);
    originalContent = JSON.stringify(sanityPost.body);
    portableTextBody = sanityPost.body;
  }

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

  // Process author data
  let author: Author | undefined;
  if (sanityPost.author) {
    let authorImageUrl = '';
    if (sanityPost.author.imageURL) {
      authorImageUrl = sanityPost.author.imageURL;
    } else if (sanityPost.author.image) {
      try {
        authorImageUrl = urlForImage(sanityPost.author.image as any) || '';
      } catch (error) {
        console.warn('Error generating author image URL:', error);
      }
    }

    author = {
      name: sanityPost.author.name,
      bio: sanityPost.author.bio,
      image: sanityPost.author.image,
      imageURL: authorImageUrl,
      xLink: sanityPost.author.xLink,
    };
  }

  // Get description
  const description = sanityPost.description || '';

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
    body: portableTextBody, // Include Portable Text blocks for backward compatibility
    mainImage: sanityPost.mainImage, // Include raw mainImage
    authorName: sanityPost.authorName,
    author,
  };
}

// Function to fetch and process engineering blog posts from Sanity (CSR)
export async function getEngineeringBlogPosts(): Promise<
  EngineeringBlogPost[]
> {
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
    console.log('[getEngineeringBlogPost] Fetching post with slug:', slug);
    console.log('[getEngineeringBlogPost] Using query:', postQuery);
    const sanityPost = await client.fetch<SanityPost | null>(postQuery, {
      slug,
    });

    console.log('[getEngineeringBlogPost] Sanity response:', sanityPost);

    if (!sanityPost) {
      console.warn('[getEngineeringBlogPost] No post found for slug:', slug);
      return null;
    }

    const converted = convertSanityPostToBlogPost(sanityPost);
    console.log('[getEngineeringBlogPost] Converted post:', converted);
    return converted;
  } catch (error) {
    console.error(
      `[getEngineeringBlogPost] Error loading blog ${slug}:`,
      error
    );
    return null;
  }
}

/**
 * Build-time script to generate static blog data for SSG
 * This script fetches all blog posts from Sanity and generates static JSON files
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { client } from '../src/lib/sanity/client';
import { postsQuery } from '../src/lib/sanity/queries';
import { urlForImage } from '../src/lib/sanity/image';
import {
  portableTextToHtml,
  addHeadingIds,
  calculateReadingTime,
} from '../src/lib/sanity/portableTextToHtml';
import type { PortableTextBlock } from '@portabletext/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

interface StaticBlogPost {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  publishedAt: string;
  readingTime: number;
  content: string; // HTML content
  originalContent: string; // JSON string of Portable Text blocks
  body?: PortableTextBlock[]; // Portable Text blocks
  mainImage?: any; // Raw mainImage
  authorName?: string;
}

function convertSanityPostToStaticPost(sanityPost: SanityPost): StaticBlogPost {
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
    body: sanityPost.body,
    mainImage: sanityPost.mainImage,
    authorName: sanityPost.authorName,
  };
}

async function generateBlogData() {
  try {
    console.log('Fetching blog posts from Sanity...');

    // Fetch all posts
    const sanityPosts = await client.fetch<SanityPost[]>(postsQuery);
    console.log(`Found ${sanityPosts.length} blog posts`);

    // Convert to static format
    const staticPosts = sanityPosts
      .map(convertSanityPostToStaticPost)
      .filter(post => post.slug);

    // Create output directory in public folder so it's accessible at runtime
    const outputDir = join(__dirname, '../public/data');
    mkdirSync(outputDir, { recursive: true });

    // Generate posts index file
    const postsIndex = staticPosts.map(post => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      description: post.description,
      image: post.image,
      publishedAt: post.publishedAt,
      readingTime: post.readingTime,
      authorName: post.authorName,
    }));

    writeFileSync(
      join(outputDir, 'blog-posts.json'),
      JSON.stringify(postsIndex, null, 2),
      'utf-8'
    );
    console.log(`Generated blog-posts.json with ${postsIndex.length} posts`);

    // Generate individual post files
    const postsDir = join(outputDir, 'posts');
    mkdirSync(postsDir, { recursive: true });

    for (const post of staticPosts) {
      writeFileSync(
        join(postsDir, `${post.slug}.json`),
        JSON.stringify(post, null, 2),
        'utf-8'
      );
    }
    console.log(`Generated ${staticPosts.length} individual post files`);

    // Generate slugs list for routing
    const slugs = staticPosts.map(post => post.slug);
    writeFileSync(
      join(outputDir, 'blog-slugs.json'),
      JSON.stringify(slugs, null, 2),
      'utf-8'
    );
    console.log('Generated blog-slugs.json');

    console.log('✅ Blog data generation complete!');
  } catch (error) {
    console.error('❌ Error generating blog data:', error);
    process.exit(1);
  }
}

// Run the script
generateBlogData();

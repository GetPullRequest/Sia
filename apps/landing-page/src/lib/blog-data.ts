/**
 * Static blog data loader for SSG
 * Loads pre-generated blog data from static JSON files
 */

import type { EngineeringBlogPost } from '../utils/engg-blog';

// Cache for loaded data
let blogPostsCache: EngineeringBlogPost[] | null = null;
let blogSlugsCache: string[] | null = null;
let blogPostsIndexCache: any[] | null = null;

// Load JSON data from static files in public folder
async function loadJsonData<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error loading JSON from ${path}:`, error);
    return null;
  }
}

// Lazy load individual post data
async function loadPostData(slug: string): Promise<EngineeringBlogPost | null> {
  try {
    const postData = await loadJsonData<EngineeringBlogPost>(
      `/data/posts/${slug}.json`
    );
    return postData;
  } catch (error) {
    console.error(`Error loading post data for slug: ${slug}`, error);
    return null;
  }
}

/**
 * Get all blog post slugs (for routing/generation)
 */
export async function getBlogSlugs(): Promise<string[]> {
  if (blogSlugsCache) {
    return blogSlugsCache;
  }

  const slugs = await loadJsonData<string[]>('/data/blog-slugs.json');
  blogSlugsCache = slugs || [];
  return blogSlugsCache;
}

/**
 * Get blog posts index (metadata only, no full content)
 */
export async function getBlogPostsIndex() {
  if (blogPostsIndexCache) {
    return blogPostsIndexCache;
  }

  const index = await loadJsonData<any[]>('/data/blog-posts.json');
  blogPostsIndexCache = index || [];
  return blogPostsIndexCache;
}

/**
 * Get all blog posts (static data)
 */
export async function getStaticBlogPosts(): Promise<EngineeringBlogPost[]> {
  if (blogPostsCache) {
    return blogPostsCache;
  }

  const slugs = await getBlogSlugs();

  // Load all posts in parallel
  const posts = await Promise.all(slugs.map(slug => loadPostData(slug)));

  // Filter out any failed loads and cache
  blogPostsCache = posts.filter(
    (post): post is EngineeringBlogPost => post !== null
  );
  return blogPostsCache;
}

/**
 * Get a single blog post by slug (static data)
 */
export async function getStaticBlogPost(
  slug: string
): Promise<EngineeringBlogPost | null> {
  const slugs = await getBlogSlugs();

  if (!slugs.includes(slug)) {
    return null;
  }

  return loadPostData(slug);
}

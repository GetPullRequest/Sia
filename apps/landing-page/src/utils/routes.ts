import { getEngineeringBlogPosts } from './engg-blog';

export async function generateRoutes() {
  const staticRoutes = ['/', '/privacy', '/terms', '/blogs'];

  // Generate dynamic blog routes
  try {
    const posts = await getEngineeringBlogPosts();
    const blogRoutes = posts.map(post => `/blogs/${post.slug}`);
    return [...staticRoutes, ...blogRoutes];
  } catch (error) {
    console.log(
      'Could not fetch blog posts for route generation, using static routes only'
    );
    return staticRoutes;
  }
}

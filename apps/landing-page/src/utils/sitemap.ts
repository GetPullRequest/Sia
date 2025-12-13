export interface SitemapUrl {
  url: string;
  lastmod?: string;
  changefreq?:
    | 'always'
    | 'hourly'
    | 'daily'
    | 'weekly'
    | 'monthly'
    | 'yearly'
    | 'never';
  priority?: number;
}

export async function generateSitemap(): Promise<string> {
  const baseUrl = 'https://getpullrequest.com';
  const urls: SitemapUrl[] = [];

  // Static pages
  urls.push(
    {
      url: `${baseUrl}/`,
      lastmod: new Date().toISOString(),
      changefreq: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blogs`,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/privacy-policy`,
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastmod: new Date().toISOString(),
      changefreq: 'monthly',
      priority: 0.3,
    }
  );

  // Dynamic blog posts - will be added when Sanity is available
  try {
    // Import dynamically to avoid build-time issues
    const { getEngineeringBlogPosts } = await import('./engg-blog');
    const posts = await getEngineeringBlogPosts();
    posts.forEach(post => {
      urls.push({
        url: `${baseUrl}/blogs/${post.slug}`,
        lastmod: new Date(post.publishedAt).toISOString(),
        changefreq: 'monthly',
        priority: 0.7,
      });
    });
  } catch (error) {
    console.log(
      'Skipping blog posts in sitemap (Sanity not available during build)'
    );
  }

  // Generate XML
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    ({ url, lastmod, changefreq, priority }) => `  <url>
    <loc>${url}</loc>
    ${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}
    ${changefreq ? `<changefreq>${changefreq}</changefreq>` : ''}
    ${priority ? `<priority>${priority}</priority>` : ''}
  </url>`
  )
  .join('\n')}
</urlset>`;

  return xml;
}

export function generateRobotsTxt(): string {
  const baseUrl = 'https://getpullrequest.com';

  return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml

# Crawl-delay
Crawl-delay: 1

# Disallow admin paths (if any)
Disallow: /admin/
Disallow: /_next/
Disallow: /api/

# Allow important pages
Allow: /
Allow: /blogs
Allow: /blogs/*
Allow: /privacy-policy
Allow: /terms-of-service`;
}

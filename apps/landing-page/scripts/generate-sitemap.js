#!/usr/bin/env node

// This script generates a sitemap with blog posts from Sanity
// Run this after deployment to include dynamic blog content

import { createClient } from 'next-sanity';
import fs from 'fs';
import path from 'path';

const client = createClient({
  projectId: process.env.VITE_SANITY_PROJECT_ID || '4cam5qzc',
  dataset: process.env.VITE_SANITY_DATASET || 'production',
  apiVersion: '2024-01-22',
  useCdn: false,
});

const postsQuery = `*[_type == "post"] | order(publishedAt desc, _createdAt desc) {
  _id,
  _createdAt,
  title,
  slug,
  publishedAt
}`;

async function generateFullSitemap() {
  const baseUrl = 'https://getpullrequest.com';
  const urls = [];

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

  // Dynamic blog posts
  try {
    const posts = await client.fetch(postsQuery);
    console.log(`Found ${posts.length} blog posts`);

    posts.forEach(post => {
      if (post.slug?.current) {
        urls.push({
          url: `${baseUrl}/blogs/${post.slug.current}`,
          lastmod: new Date(post.publishedAt || post._createdAt).toISOString(),
          changefreq: 'monthly',
          priority: 0.7,
        });
      }
    });
  } catch (error) {
    console.error('Error fetching blog posts:', error);
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

  // Write to file
  const outputPath = process.argv[2] || './sitemap.xml';
  fs.writeFileSync(outputPath, xml);
  console.log(`✓ Generated sitemap with ${urls.length} URLs: ${outputPath}`);
}

generateFullSitemap().catch(console.error);

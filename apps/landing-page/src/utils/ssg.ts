import { generateSitemap, generateRobotsTxt } from './sitemap';
import fs from 'fs';
import path from 'path';

export async function generateStaticFiles(outputDir: string) {
  try {
    // Generate sitemap.xml
    const sitemap = await generateSitemap();
    fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), sitemap);
    console.log('✓ Generated sitemap.xml');

    // Generate robots.txt
    const robotsTxt = generateRobotsTxt();
    fs.writeFileSync(path.join(outputDir, 'robots.txt'), robotsTxt);
    console.log('✓ Generated robots.txt');

    // Return basic routes for now
    const routes = ['/', '/blogs', '/privacy-policy', '/terms-of-service'];

    return routes;
  } catch (error) {
    console.error('Error generating static files:', error);
    return ['/'];
  }
}

import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
}

export default function SEO({
  title = 'GetPullRequest - AI Dev Assistant That Creates PRs While You Sleep',
  description = 'Sia is an AI developer assistant that lives in Slack and Discord. Delegate coding tasks, queue them, and wake up to ready-to-review pull requests. Turn idle hours into productive development time.',
  keywords = 'AI coding assistant, automated pull requests, developer productivity, Slack bot, Discord bot, AI development tools, Claude Agent, Aider, async development, developer workflow, engineering automation',
  ogImage = '/og-image.jpg',
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const metaTags = [
      { name: 'description', content: description },
      { name: 'keywords', content: keywords },
      { name: 'favicon', content: '/favicon.ico' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:favicon', content: '/favicon.ico' },
      { property: 'og:image', content: ogImage },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
      { name: 'twitter:favicon', content: '/favicon.ico' },
    ];

    metaTags.forEach(({ name, property, content }) => {
      const attribute = name ? 'name' : 'property';
      const value = name || property;

      let element = document.querySelector(`meta[${attribute}="${value}"]`);

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, value || '');
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    });
  }, [title, description, keywords, ogImage]);

  return null;
}

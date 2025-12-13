import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PortableText } from '@portabletext/react';
import Navbar from '../components/Navbar';
import BlogContents from '../components/blog/BlogContents';
import AuthorSection from '../components/blog/AuthorSection';
import SEOHead from '../components/SEOHead';
import {
  getEngineeringBlogPost,
  EngineeringBlogPost,
} from '../utils/engg-blog';
import { ChevronRight } from 'lucide-react';
import { createImageUrlBuilder } from '@sanity/image-url';

// Create image URL builder
const imageBuilder = createImageUrlBuilder({
  projectId:
    import.meta.env.VITE_SANITY_PROJECT_ID ||
    import.meta.env.NEXT_PUBLIC_SANITY_PROJECT_ID ||
    '',
  dataset:
    import.meta.env.VITE_SANITY_DATASET ||
    import.meta.env.NEXT_PUBLIC_SANITY_DATASET ||
    '',
});

// PortableText components for custom rendering with center alignment
const portableTextComponents = {
  types: {
    image: ({ value }: any) => {
      if (!value?.asset) return null;
      const imageUrl = imageBuilder.image(value).width(800).height(600).url();
      return (
        <figure className="my-8 text-center">
          <img
            src={imageUrl}
            alt={value.alt || ''}
            className="mx-auto w-full h-auto rounded-lg shadow-lg max-w-4xl"
          />
          {value.caption && (
            <figcaption className="mt-2 text-sm text-text/70 text-center">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
    table: ({ value }: any) => {
      // Render table with scrollable container for mobile
      return (
        <div className="table-scroll-container">
          <table className="border-collapse my-4 text-white/80 w-full">
            {value.rows?.map((row: any, rowIndex: number) => (
              <tr key={rowIndex}>
                {row.cells?.map((cell: any, cellIndex: number) => {
                  const Tag = rowIndex === 0 ? 'th' : 'td';
                  const className =
                    rowIndex === 0
                      ? 'border border-gray-600 px-3 py-2 bg-gray-800 font-bold text-blue-300'
                      : 'border border-gray-600 px-3 py-2 text-white/80';
                  return (
                    <Tag key={cellIndex} className={className}>
                      {cell}
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </table>
        </div>
      );
    },
  },
  block: {
    normal: ({ children }: any) => (
      <p className="text-center mb-4">{children}</p>
    ),
    h1: ({ children }: any) => (
      <h1 className="text-center font-bold mb-4 mt-8">{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 className="text-center font-bold mb-4 mt-8">{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 className="text-center font-bold mb-4 mt-6">{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 className="text-center font-bold mb-4 mt-6">{children}</h4>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className="text-center border-l-4 border-gray-300 pl-4 italic my-6">
        {children}
      </blockquote>
    ),
  },
  list: {
    bullet: ({ children }: any) => (
      <ul className="text-center list-inside my-4">{children}</ul>
    ),
    number: ({ children }: any) => (
      <ol className="text-center list-inside my-4">{children}</ol>
    ),
  },
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<EngineeringBlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      if (!slug) {
        setError('Invalid blog post');
        setLoading(false);
        return;
      }

      try {
        console.log('[BlogPost] Loading post with slug:', slug);
        const loadedPost = await getEngineeringBlogPost(slug);
        console.log('[BlogPost] Loaded post:', loadedPost);
        if (!loadedPost) {
          console.warn('[BlogPost] Post not found for slug:', slug);
          setError(`Blog post not found for slug: ${slug}`);
        } else {
          setPost(loadedPost);
        }
      } catch (err) {
        console.error('[BlogPost] Error loading blog post:', err);
        setError(
          `Failed to load blog post: ${
            err instanceof Error ? err.message : 'Unknown error'
          }`
        );
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <>
        <SEOHead
          title="Loading... | Sia Blogs"
          description="Loading blog post..."
        />
        <Navbar />
        <div className="min-h-screen bg-background">
          <section className="py-16 sm:py-20 md:py-28 relative w-full">
            <div className="container px-4 sm:px-6 w-full max-w-5xl mx-auto">
              <div className="text-center py-12">
                <p className="text-gray-300 text-lg">Loading blog post...</p>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  if (error || !post) {
    return (
      <>
        <SEOHead
          title="Blog Post Not Found | Sia Blogs"
          description="The requested blog post could not be found."
        />
        <Navbar />
        <div className="min-h-screen bg-background">
          <section className="py-16 sm:py-20 md:py-28 relative w-full">
            <div className="container px-4 sm:px-6 w-full max-w-5xl mx-auto">
              <div className="text-center py-12">
                <p className="text-gray-300 text-lg">
                  {error || 'Blog post not found'}
                </p>
                <Link
                  to="/blogs"
                  className="mt-4 inline-block text-primary hover:opacity-80 transition-opacity"
                >
                  ← Back to Blogs
                </Link>
              </div>
            </div>
          </section>
        </div>
      </>
    );
  }

  const blogUrl = `https://getpullrequest.com/blogs/${post.slug}`;
  const publishedTime = new Date(post.publishedAt).toISOString();

  return (
    <>
      <SEOHead
        title={`${post.title} | Sia Blogs`}
        description={
          post.description || `Read ${post.title} on Sia's engineering blog`
        }
        keywords={`${post.title}, Sia engineering, AI development, technical blog, software engineering`}
        image={post.image || '/banner.png'}
        url={blogUrl}
        type="article"
        publishedTime={publishedTime}
        modifiedTime={publishedTime}
      />
      <Navbar />
      <div className="min-h-screen bg-background">
        <main className="container mx-auto prose prose-xl px-4 sm:px-6 pt-32 py-16 max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Main Content */}
            <div className="flex-1 lg:pr-8 xl:pr-80">
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-text/70 not-prose">
                <Link to="/" className="hover:text-primary transition-colors">
                  Home
                </Link>
                <ChevronRight className="w-4 h-4" />
                <Link
                  to="/blogs"
                  className="hover:text-primary transition-colors"
                >
                  Blogs
                </Link>
                <ChevronRight className="w-4 h-4" />
                <span className="text-text/70">{post.title}</span>
              </div>

              {/* Title */}
              <h1 className="text-white text-center leading-none">
                {post.title}
              </h1>

              {/* Description */}
              {post.description && (
                <p className="text-white/70 text-center">{post.description}</p>
              )}

              {/* Main Image */}
              {post.mainImage && post.image && (
                <div className="text-center my-8">
                  <img
                    src={post.image}
                    alt={post.mainImage.alt || post.title}
                    className="mx-auto w-full h-auto rounded-lg shadow-lg max-w-4xl"
                  />
                </div>
              )}

              {/* Content */}
              <div className="prose prose-xl max-w-none">
                {post.body && Array.isArray(post.body) ? (
                  <PortableText
                    value={post.body}
                    components={portableTextComponents}
                  />
                ) : (
                  <div
                    className="markdown-content"
                    dangerouslySetInnerHTML={{ __html: post.content }}
                  />
                )}
              </div>

              {/* Author Section */}
              {post.author && (
                <div className="not-prose">
                  <AuthorSection author={post.author} />
                </div>
              )}
            </div>

            {/* Contents Sidebar - Hidden on mobile, fixed on desktop */}
            <div className="hidden xl:block">
              <BlogContents
                content={post.content}
                contentType="html"
                isSeoBot={false}
              />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}

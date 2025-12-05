import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PortableText } from '@portabletext/react';
import Navbar from '../components/Navbar';
import BlogContents from '../components/blog/BlogContents';
import { getEngineeringBlogPost, EngineeringBlogPost } from '../utils/engg-blog';
import { ChevronRight } from 'lucide-react';
import { createImageUrlBuilder } from '@sanity/image-url';

// Create image URL builder
const imageBuilder = createImageUrlBuilder({
  projectId: import.meta.env.VITE_SANITY_PROJECT_ID || import.meta.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '',
  dataset: import.meta.env.VITE_SANITY_DATASET || import.meta.env.NEXT_PUBLIC_SANITY_DATASET || '',
});

// PortableText components for custom rendering
const portableTextComponents = {
  types: {
    image: ({ value }: any) => {
      if (!value?.asset) return null;
      const imageUrl = imageBuilder.image(value).width(800).height(600).url();
      return (
        <figure className="my-8">
          <img
            src={imageUrl}
            alt={value.alt || ''}
            className="w-full h-auto rounded-lg shadow-lg"
          />
          {value.caption && (
            <figcaption className="mt-2 text-sm text-text/70 text-center">
              {value.caption}
            </figcaption>
          )}
        </figure>
      );
    },
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
        const loadedPost = await getEngineeringBlogPost(slug);
        if (!loadedPost) {
          setError('Blog post not found');
        } else {
          setPost(loadedPost);
        }
      } catch (err) {
        console.error('Error loading blog post:', err);
        setError('Failed to load blog post');
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <>
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

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <main className="container mx-auto prose prose-xl px-4 py-16 max-w-7xl">
          <div className="flex gap-8">
            {/* Main Content */}
            <div className="flex-1 lg:pr-80">
              {/* Breadcrumb */}
              <div className="flex flex-wrap items-center gap-2 mb-4 text-sm text-text/70 not-prose">
                <Link
                  to="/"
                  className="hover:text-primary transition-colors"
                >
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
              <h1 className="text-text">{post.title}</h1>

              {/* Description */}
              {post.description && (
                <p className="text-text/70">{post.description}</p>
              )}

              {/* Main Image */}
              {post.mainImage && post.image && (
                <img
                  src={post.image}
                  alt={post.mainImage.alt || post.title}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              )}

              {/* Content - Using PortableText like sanity-blog */}
              {post.body ? (
                <PortableText value={post.body} components={portableTextComponents} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: post.content }} />
              )}
            </div>

            {/* Contents Sidebar - Fixed Position */}
            <div className="hidden lg:block">
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

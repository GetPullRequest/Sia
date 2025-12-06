
"use client";
import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EngineeringBlogCard from '../components/blog/EngineeringBlogCard';
import { getEngineeringBlogPosts, EngineeringBlogPost } from '../utils/engg-blog';

export default function Blogs() {
  const [posts, setPosts] = useState<EngineeringBlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPosts() {
      try {
        const loadedPosts = await getEngineeringBlogPosts();
        setPosts(loadedPosts);
      } catch (error) {
        console.error('Error loading blog posts:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">

        <section className="py-20 sm:py-20 md:py-28 relative flex justify-center w-full">
          <div className="container px-4 sm:px-6 w-full max-w-5xl mx-auto">
            <h1 className="text-heading md:text-heading-md lg:text-heading-lg font-bold mb-2 text-center text-white">
              Sia Blogs
            </h1>
            <p className="text-body md:text-body-md lg:text-body-lg text-text/70 text-center mb-12 max-w-3xl mx-auto">
              Deep technical insights into building Sia, conversation
              intelligence, and real-time systems from the Sia engineering
              team.
            </p>

            {loading ? (
              <div className="text-center py-12">
                <p className="text-text/70 text-lg">Loading blogs...</p>
              </div>
            ) : (
              <div className="prose prose-lg max-w-none">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {posts.map((post) => (
                    <EngineeringBlogCard key={post.id} post={post} />
                  ))}
                </div>
                {posts.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-300 text-lg">
                      No blog posts available yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
        <Footer />
      </div>
    </>
  );
}

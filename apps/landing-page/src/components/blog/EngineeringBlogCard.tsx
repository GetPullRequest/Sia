import { Link } from 'react-router-dom';
import { EngineeringBlogPost } from '../../utils/engg-blog';

interface EngineeringBlogCardProps {
  post: EngineeringBlogPost;
}

const EngineeringBlogCard: React.FC<EngineeringBlogCardProps> = ({ post }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100 transition-all duration-300 hover:shadow-md hover:scale-[1.02] min-w-0 overflow-hidden">
      {/* Image Section */}
      <div className="w-full h-48 bg-purple-100 flex items-center justify-center">
        {post.image ? (
          <img
            src={post.image}
            alt={post.title}
            className="w-full h-full object-cover bg-white"
            onError={e => {
              // Fallback if image fails to load
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              if (target.parentElement) {
                target.parentElement.innerHTML =
                  '<div class="text-4xl font-bold text-gray-700">E</div>';
              }
            }}
          />
        ) : (
          <div className="text-4xl font-bold text-gray-700">E</div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 bg-card rounded-lg text-center">
        {/* Date and Author */}
        <div className="flex items-center justify-center gap-4 text-sm text-text/70 mb-2">
          <span>
            {new Date(post.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
          {post.author?.name && (
            <>
              <span>•</span>
              <span>{post.author.name}</span>
            </>
          )}
        </div>

        {/* Title */}
        <Link
          to={`/blogs/${post.slug}`}
          className="block mb-3 text-lg font-semibold text-text hover:text-blue-600 transition-colors line-clamp-2 text-center"
        >
          {post.title}
        </Link>

        {/* Description */}
        <p className="text-text/70 text-sm line-clamp-3 mb-3 text-center">
          {post.description}
        </p>
      </div>
    </div>
  );
};

export default EngineeringBlogCard;

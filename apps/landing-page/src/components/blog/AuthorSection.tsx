import { Author } from '../../utils/engg-blog';
import { PortableText } from '@portabletext/react';

interface AuthorSectionProps {
  author: Author;
}

const AuthorSection: React.FC<AuthorSectionProps> = ({ author }) => {
  return (
    <div className="border-t border-gray-200 pt-8 mt-12">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        {/* Author Initial/Photo */}
        <div className="flex-shrink-0">
          {author.imageURL ? (
            <img
              src={author.imageURL}
              alt={author.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-semibold text-lg">
              {author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Author Info */}
        <div className="flex-1 text-center sm:text-left">
          <div className="mb-0">
            {author.xLink ? (
              <a
                href={author.xLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-blue-600 hover:text-blue-800 transition-colors underline"
              >
                {author.name}
              </a>
            ) : (
              <h3 className="text-lg font-semibold text-gray-900">
                {author.name}
              </h3>
            )}
          </div>
          {author.bio && (
            <div className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none">
              {typeof author.bio === 'string' ? (
                <p>{author.bio}</p>
              ) : (
                <PortableText value={author.bio} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorSection;

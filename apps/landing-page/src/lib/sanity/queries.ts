import { groq } from 'next-sanity';

// Get all posts
export const postsQuery = groq`*[_type == "post"] | order(publishedAt desc, _createdAt desc) {
  _id,
  _createdAt,
  title,
  description,
  slug,
  mainImage,
  "imageURL": mainImage.asset->url,
  publishedAt,
  "authorName": author->name,
  "author": author->{
    name,
    bio,
    image,
    "imageURL": image.asset->url,
    "xLink": twitterUrl
  },
  body
}`;

// Get a single post by its slug
export const postQuery = groq`*[_type == "post" && slug.current == $slug][0]{ 
  _id,
  _createdAt,
  title, 
  description, 
  mainImage,
  "imageURL": mainImage.asset->url,
  publishedAt,
  "authorName": author->name,
  "author": author->{
    name,
    bio,
    image,
    "imageURL": image.asset->url,
    "xLink": twitterUrl
  },
  body
}`;

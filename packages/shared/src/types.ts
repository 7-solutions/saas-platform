// Shared types across the platform

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'editor';
  profile: {
    name: string;
    avatar?: string;
  };
  created_at: string;
  last_login?: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: {
    blocks: ContentBlock[];
  };
  meta: {
    title: string;
    description: string;
  };
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ContentBlock {
  type: string;
  data: Record<string, any>;
}

export interface MediaFile {
  id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  url: string;
  alt_text?: string;
  uploaded_by: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: {
    blocks: ContentBlock[];
  };
  meta: {
    title: string;
    description: string;
  };
  status: 'draft' | 'published';
  author: string;
  categories: string[];
  tags: string[];
  featured_image?: string;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  name: string;
  slug: string;
  post_count: number;
}

export interface BlogTag {
  name: string;
  slug: string;
  post_count: number;
}
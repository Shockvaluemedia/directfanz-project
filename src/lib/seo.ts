import { Metadata } from 'next';

export interface SEOConfig {
  siteName: string;
  siteUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultImage: string;
  twitterHandle: string;
  facebookAppId?: string;
  author: string;
  keywords: string[];
}

const seoConfig: SEOConfig = {
  siteName: 'Direct Fan',
  siteUrl: process.env.NEXTAUTH_URL || 'https://directfan.com',
  defaultTitle: 'Direct Fan - Connect Creators with Fans',
  defaultDescription:
    'The platform where creators connect directly with their fans through exclusive content and personalized interactions.',
  defaultImage: '/images/og-default.jpg',
  twitterHandle: '@directfan',
  facebookAppId: process.env.FACEBOOK_APP_ID,
  author: 'Direct Fan Team',
  keywords: [
    'creators',
    'fans',
    'subscription',
    'exclusive content',
    'direct connection',
    'artist platform',
    'fan engagement',
    'content creators',
    'monetization',
    'creative community',
  ],
};

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noIndex?: boolean;
  noFollow?: boolean;
  canonical?: string;
}

// Generate comprehensive metadata for Next.js pages
export function generateMetadata(props: SEOProps = {}): Metadata {
  const {
    title,
    description = seoConfig.defaultDescription,
    image = seoConfig.defaultImage,
    url,
    type = 'website',
    publishedTime,
    modifiedTime,
    author = seoConfig.author,
    tags = [],
    noIndex = false,
    noFollow = false,
    canonical,
  } = props;

  const fullTitle = title ? `${title} | ${seoConfig.siteName}` : seoConfig.defaultTitle;

  const fullImage = image.startsWith('http') ? image : `${seoConfig.siteUrl}${image}`;

  const fullUrl = url ? `${seoConfig.siteUrl}${url}` : seoConfig.siteUrl;

  const allKeywords = [...seoConfig.keywords, ...tags].join(', ');

  const metadata: Metadata = {
    title: fullTitle,
    description,
    keywords: allKeywords,
    authors: [{ name: author }],
    creator: author,
    publisher: seoConfig.siteName,
    robots: {
      index: !noIndex,
      follow: !noFollow,
      googleBot: {
        index: !noIndex,
        follow: !noFollow,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      siteName: seoConfig.siteName,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: title || seoConfig.defaultTitle,
        },
      ],
      locale: 'en_US',
      type: type as any,
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [fullImage],
      creator: seoConfig.twitterHandle,
      site: seoConfig.twitterHandle,
    },
    alternates: {
      canonical: canonical || fullUrl,
    },
    other: {
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': seoConfig.siteName,
      'application-name': seoConfig.siteName,
      'msapplication-TileColor': '#4F46E5',
      'theme-color': '#4F46E5',
    },
  };

  // Add Facebook App ID if available
  if (seoConfig.facebookAppId) {
    metadata.other = {
      ...metadata.other,
      'fb:app_id': seoConfig.facebookAppId,
    };
  }

  return metadata;
}

// Generate structured data (JSON-LD)
export interface StructuredDataProps {
  type: 'website' | 'organization' | 'person' | 'article' | 'product' | 'creativeWork';
  name: string;
  description: string;
  url: string;
  image?: string;
  author?: string;
  datePublished?: string;
  dateModified?: string;
  price?: number;
  currency?: string;
  rating?: {
    value: number;
    count: number;
  };
}

export function generateStructuredData(props: StructuredDataProps): string {
  const {
    type,
    name,
    description,
    url,
    image,
    author,
    datePublished,
    dateModified,
    price,
    currency,
    rating,
  } = props;

  const baseData = {
    '@context': 'https://schema.org',
    '@type':
      type === 'creativeWork'
        ? 'CreativeWork'
        : type === 'website'
          ? 'WebSite'
          : type === 'organization'
            ? 'Organization'
            : type === 'person'
              ? 'Person'
              : type === 'article'
                ? 'Article'
                : 'Product',
    name,
    description,
    url,
    ...(image && { image }),
  };

  // Add type-specific properties
  if (type === 'website') {
    return JSON.stringify({
      ...baseData,
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${seoConfig.siteUrl}/search?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    });
  }

  if (type === 'organization') {
    return JSON.stringify({
      ...baseData,
      logo: `${seoConfig.siteUrl}/images/logo.png`,
      sameAs: [
        'https://twitter.com/directfan',
        'https://facebook.com/directfan',
        'https://instagram.com/directfan',
      ],
    });
  }

  if (type === 'article' || type === 'creativeWork') {
    return JSON.stringify({
      ...baseData,
      author: {
        '@type': 'Person',
        name: author,
      },
      publisher: {
        '@type': 'Organization',
        name: seoConfig.siteName,
        logo: {
          '@type': 'ImageObject',
          url: `${seoConfig.siteUrl}/images/logo.png`,
        },
      },
      ...(datePublished && { datePublished }),
      ...(dateModified && { dateModified }),
    });
  }

  if (type === 'product') {
    return JSON.stringify({
      ...baseData,
      offers: {
        '@type': 'Offer',
        price: price,
        priceCurrency: currency || 'USD',
        availability: 'https://schema.org/InStock',
      },
      ...(rating && {
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: rating.value,
          reviewCount: rating.count,
        },
      }),
    });
  }

  return JSON.stringify(baseData);
}

// Generate sitemap data
export interface SitemapEntry {
  url: string;
  lastModified: Date;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export class SitemapGenerator {
  private entries: SitemapEntry[] = [];

  // Add static pages
  addStaticPages(): void {
    const staticPages = [
      { url: '/', priority: 1.0, changeFreq: 'daily' as const },
      { url: '/artists', priority: 0.9, changeFreq: 'daily' as const },
      { url: '/about', priority: 0.7, changeFreq: 'monthly' as const },
      { url: '/privacy', priority: 0.5, changeFreq: 'yearly' as const },
      { url: '/terms', priority: 0.5, changeFreq: 'yearly' as const },
      { url: '/contact', priority: 0.6, changeFreq: 'monthly' as const },
      { url: '/help', priority: 0.6, changeFreq: 'monthly' as const },
    ];

    this.entries.push(
      ...staticPages.map(page => ({
        url: `${seoConfig.siteUrl}${page.url}`,
        lastModified: new Date(),
        changeFrequency: page.changeFreq,
        priority: page.priority,
      }))
    );
  }

  // Add artist profiles
  addArtistProfiles(artists: { username: string; updatedAt: Date }[]): void {
    this.entries.push(
      ...artists.map(artist => ({
        url: `${seoConfig.siteUrl}/artist/${artist.username}`,
        lastModified: artist.updatedAt,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    );
  }

  // Add content pages
  addContentPages(content: { id: string; updatedAt: Date }[]): void {
    this.entries.push(
      ...content.map(item => ({
        url: `${seoConfig.siteUrl}/content/${item.id}`,
        lastModified: item.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    );
  }

  // Generate XML sitemap
  generateXML(): string {
    const urlElements = this.entries
      .map(
        entry => `
  <url>
    <loc>${entry.url}</loc>
    <lastmod>${entry.lastModified.toISOString()}</lastmod>
    <changefreq>${entry.changeFrequency}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
  }

  // Clear entries
  clear(): void {
    this.entries = [];
  }
}

// Social sharing utilities
export interface ShareData {
  url: string;
  title: string;
  description: string;
  image?: string;
  hashtags?: string[];
}

export class SocialSharing {
  static generateShareUrls(data: ShareData) {
    const encodedUrl = encodeURIComponent(data.url);
    const encodedTitle = encodeURIComponent(data.title);
    const encodedDescription = encodeURIComponent(data.description);
    const encodedImage = data.image ? encodeURIComponent(data.image) : '';
    const hashtags = data.hashtags ? data.hashtags.join(',') : '';

    return {
      twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
      reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
      pinterest: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}${encodedImage ? `&media=${encodedImage}` : ''}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodedTitle}%20${encodedUrl}`,
      telegram: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`,
    };
  }

  static generateCopyLink(url: string): string {
    return `
      <button 
        onclick="navigator.clipboard.writeText('${url}').then(() => alert('Link copied!'))"
        class="share-button copy-link"
      >
        Copy Link
      </button>
    `;
  }
}

// Meta tag helpers for specific page types
export const MetaTags = {
  // Artist profile page
  artists: (artist: {
    displayName: string;
    bio: string;
    profileImage: string;
    username: string;
    followerCount?: number;
    contentCount?: number;
  }): SEOProps => ({
    title: `${artist.displayName} - Artist Profile`,
    description: `${artist.bio.slice(0, 160)}... Follow ${artist.displayName} for exclusive content and updates.`,
    image: artist.profileImage,
    url: `/artist/${artist.username}`,
    type: 'profile',
    tags: ['artist', 'profile', 'creator', artist.displayName.toLowerCase()],
  }),

  // Content page
  contentPage: (content: {
    title: string;
    description: string;
    image: string;
    id: string;
    artistName: string;
    publishedAt: Date;
  }): SEOProps => ({
    title: `${content.title} by ${content.artistName}`,
    description: content.description,
    image: content.image,
    url: `/content/${content.id}`,
    type: 'article',
    publishedTime: content.publishedAt.toISOString(),
    author: content.artistName,
    tags: ['content', 'exclusive', content.artistName.toLowerCase()],
  }),

  // Landing page for artists
  artistsListing: (): SEOProps => ({
    title: 'Discover Amazing Creators',
    description:
      'Browse and discover talented creators on Direct Fan. Find exclusive content, connect with artists, and support your favorites.',
    url: '/artists',
    tags: ['artists', 'creators', 'discover', 'browse'],
  }),

  // Search results page
  searchResults: (query: string, resultCount: number): SEOProps => ({
    title: `Search Results for "${query}"`,
    description: `Found ${resultCount} results for "${query}". Discover creators and content matching your interests.`,
    url: `/search?q=${encodeURIComponent(query)}`,
    tags: ['search', 'results', query.toLowerCase()],
    noIndex: resultCount === 0, // Don't index empty search results
  }),
};

// Robots.txt generator
export function generateRobotsTxt(): string {
  return `User-agent: *
Allow: /

# Sitemap
Sitemap: ${seoConfig.siteUrl}/sitemap.xml

# Disallow admin and private areas
Disallow: /admin/
Disallow: /api/
Disallow: /dashboard/private/
Disallow: /checkout/
Disallow: /settings/

# Allow important pages
Allow: /artist/
Allow: /content/
Allow: /about
Allow: /help

# Crawl delay
Crawl-delay: 1`;
}

export default {
  generateMetadata,
  generateStructuredData,
  SitemapGenerator,
  SocialSharing,
  MetaTags,
  generateRobotsTxt,
  seoConfig,
};

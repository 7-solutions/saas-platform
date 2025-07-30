import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button, Card } from '@saas-platform/ui';
import type { PageContent, ContentBlock } from '@saas-platform/shared';

interface ContentRendererProps {
  content: PageContent;
}

interface BlockRendererProps {
  block: ContentBlock;
}

// Individual block renderers
function HeroBlockRenderer({ block }: BlockRendererProps) {
  const { title, subtitle, image, ctaText, ctaLink } = block.data;

  return (
    <section className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-6 text-lg leading-8 text-blue-100">
              {subtitle}
            </p>
          )}
          {ctaText && ctaLink && (
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                <Link href={ctaLink}>{ctaText}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
      {image && (
        <div className="absolute inset-0 -z-10">
          <Image
            src={image}
            alt=""
            fill
            className="object-cover opacity-20"
            priority
          />
        </div>
      )}
    </section>
  );
}

function TextBlockRenderer({ block }: BlockRendererProps) {
  const { content, alignment = 'left' } = block.data;

  const alignmentClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div className={`prose prose-lg max-w-none ${alignmentClasses[alignment as keyof typeof alignmentClasses] || 'text-left'}`}>
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </div>
  );
}

function ImageBlockRenderer({ block }: BlockRendererProps) {
  const { src, alt, caption, width, height } = block.data;

  return (
    <figure className="my-8">
      <div className="relative">
        <Image
          src={src}
          alt={alt || ''}
          width={parseInt(width) || 800}
          height={parseInt(height) || 600}
          className="rounded-lg shadow-lg"
        />
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-600">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function FeatureGridRenderer({ block }: BlockRendererProps) {
  const { title, subtitle, features } = block.data;
  
  let parsedFeatures: Array<{ title: string; description: string; icon?: string }> = [];
  
  try {
    parsedFeatures = JSON.parse(features || '[]');
  } catch (error) {
    console.error('Error parsing features:', error);
  }

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {(title || subtitle) && (
          <div className="mx-auto max-w-2xl text-center mb-16">
            {title && (
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-6 text-lg leading-8 text-gray-600">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
          <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
            {parsedFeatures.map((feature, index) => (
              <Card key={index} className="p-6">
                {feature.icon && (
                  <div className="text-4xl mb-4">{feature.icon}</div>
                )}
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToActionRenderer({ block }: BlockRendererProps) {
  const { title, subtitle, primaryButtonText, primaryButtonLink, secondaryButtonText, secondaryButtonLink, backgroundColor = 'gray-50' } = block.data;

  return (
    <section className={`bg-${backgroundColor}`}>
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          {title && (
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600">
              {subtitle}
            </p>
          )}
          <div className="mt-10 flex items-center justify-center gap-x-6">
            {primaryButtonText && primaryButtonLink && (
              <Button asChild size="lg">
                <Link href={primaryButtonLink}>{primaryButtonText}</Link>
              </Button>
            )}
            {secondaryButtonText && secondaryButtonLink && (
              <Button asChild variant="outline" size="lg">
                <Link href={secondaryButtonLink}>{secondaryButtonText}</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuoteRenderer({ block }: BlockRendererProps) {
  const { quote, author, role, company } = block.data;

  return (
    <blockquote className="my-8 border-l-4 border-blue-500 pl-6 italic">
      <p className="text-lg text-gray-700 mb-4">"{quote}"</p>
      {author && (
        <footer className="text-sm text-gray-600">
          <cite className="not-italic font-semibold">{author}</cite>
          {role && <span>, {role}</span>}
          {company && <span> at {company}</span>}
        </footer>
      )}
    </blockquote>
  );
}

function VideoRenderer({ block }: BlockRendererProps) {
  const { src, title, width = '800', height = '450' } = block.data;

  return (
    <div className="my-8">
      <div className="relative aspect-video">
        <iframe
          src={src}
          title={title || 'Video'}
          width={width}
          height={height}
          className="w-full h-full rounded-lg shadow-lg"
          allowFullScreen
        />
      </div>
    </div>
  );
}

// Main block renderer that delegates to specific renderers
function BlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case 'hero':
      return <HeroBlockRenderer block={block} />;
    case 'text':
      return <TextBlockRenderer block={block} />;
    case 'image':
      return <ImageBlockRenderer block={block} />;
    case 'feature-grid':
      return <FeatureGridRenderer block={block} />;
    case 'cta':
      return <CallToActionRenderer block={block} />;
    case 'quote':
      return <QuoteRenderer block={block} />;
    case 'video':
      return <VideoRenderer block={block} />;
    default:
      console.warn(`Unknown block type: ${block.type}`);
      return (
        <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-yellow-800">
            Unknown content block type: <code className="font-mono">{block.type}</code>
          </p>
        </div>
      );
  }
}

// Main content renderer component
export function ContentRenderer({ content }: ContentRendererProps) {
  if (!content || !content.blocks || content.blocks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No content available.</p>
      </div>
    );
  }

  return (
    <div className="content-renderer">
      {content.blocks.map((block, index) => (
        <div key={index} className="content-block">
          <BlockRenderer block={block} />
        </div>
      ))}
    </div>
  );
}
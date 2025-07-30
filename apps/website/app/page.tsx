import Link from 'next/link';
import { Button, Card } from '@saas-platform/ui';
import { MainLayout } from '../components/layout';

export default function HomePage() {
  const features = [
    {
      title: 'Modern Architecture',
      description: 'Built with Next.js, TypeScript, and Go for maximum performance and scalability.',
      icon: '🏗️',
    },
    {
      title: 'Content Management',
      description: 'Powerful CMS with rich text editing and media management capabilities.',
      icon: '📝',
    },
    {
      title: 'Developer Friendly',
      description: 'Containerized development environment with hot reloading and modern tooling.',
      icon: '⚡',
    },
    {
      title: 'Responsive Design',
      description: 'Mobile-first design with Tailwind CSS and shadcn/ui components.',
      icon: '📱',
    },
    {
      title: 'API-First',
      description: 'gRPC backend with REST gateway for flexible integration possibilities.',
      icon: '🔌',
    },
    {
      title: 'Production Ready',
      description: 'Comprehensive testing, monitoring, and deployment configurations included.',
      icon: '🚀',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Build Your SaaS Platform
            </h1>
            <p className="mt-6 text-lg leading-8 text-blue-100">
              A modern, scalable platform built with Next.js, TypeScript, Go, and CouchDB. 
              Everything you need to launch your startup quickly and efficiently.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                <Link href="/contact">Get Started</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="border-white text-white hover:bg-white hover:text-blue-600">
                <Link href="/about">Learn More</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Everything you need to succeed
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Our platform provides all the tools and infrastructure you need to build, 
              deploy, and scale your SaaS application.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {features.map((feature) => (
                <Card key={feature.title} className="p-6">
                  <div className="text-4xl mb-4">{feature.icon}</div>
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

      {/* CTA Section */}
      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Ready to get started?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-gray-600">
              Join thousands of developers who are building amazing SaaS applications 
              with our platform.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button asChild size="lg">
                <Link href="/contact">Start Building</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/services">View Services</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
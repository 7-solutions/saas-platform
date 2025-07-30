import Link from 'next/link';
import { MainLayout } from '../../components/layout';
import { Button, Card } from '@saas-platform/ui';

export const metadata = {
  title: 'Services - SaaS Platform',
  description: 'Discover our comprehensive SaaS development services and solutions.',
};

export default function ServicesPage() {
  const services = [
    {
      title: 'Platform Development',
      description: 'Complete SaaS platform development with modern technologies and best practices.',
      features: [
        'Next.js frontend development',
        'Go backend with gRPC APIs',
        'CouchDB database setup',
        'Containerized deployment',
      ],
      price: 'Custom',
      popular: false,
    },
    {
      title: 'Consulting & Architecture',
      description: 'Expert guidance on SaaS architecture, technology choices, and best practices.',
      features: [
        'Architecture review',
        'Technology recommendations',
        'Performance optimization',
        'Security assessment',
      ],
      price: '$200/hour',
      popular: true,
    },
    {
      title: 'Maintenance & Support',
      description: 'Ongoing maintenance, updates, and technical support for your SaaS platform.',
      features: [
        '24/7 monitoring',
        'Regular updates',
        'Bug fixes',
        'Performance optimization',
      ],
      price: '$500/month',
      popular: false,
    },
  ];

  const technologies = [
    {
      category: 'Frontend',
      items: ['Next.js', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'],
      icon: '🎨',
    },
    {
      category: 'Backend',
      items: ['Go', 'gRPC', 'REST APIs', 'JWT Authentication'],
      icon: '⚙️',
    },
    {
      category: 'Database',
      items: ['CouchDB', 'Document Storage', 'Views & Indexes', 'Replication'],
      icon: '🗄️',
    },
    {
      category: 'DevOps',
      items: ['Docker', 'CI/CD', 'Monitoring'],
      icon: '🚀',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Our Services
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Comprehensive SaaS development services to help you build, deploy, 
              and scale your application with confidence.
            </p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Choose the right service for you
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              From complete platform development to ongoing support, we have you covered.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {services.map((service) => (
                <Card 
                  key={service.title} 
                  className={`p-8 relative ${service.popular ? 'ring-2 ring-primary' : ''}`}
                >
                  {service.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-primary text-white px-3 py-1 text-sm font-medium rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {service.title}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {service.description}
                  </p>
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-gray-900">
                      {service.price}
                    </span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {service.features.map((feature) => (
                      <li key={feature} className="flex items-center">
                        <svg
                          className="h-5 w-5 text-green-500 mr-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span className="text-gray-600">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href="/contact">Get Started</Link>
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Technologies Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Technologies We Use
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We leverage the latest and most reliable technologies to build your SaaS platform.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-2 xl:grid-cols-4">
              {technologies.map((tech) => (
                <Card key={tech.category} className="p-6">
                  <div className="text-3xl mb-4">{tech.icon}</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {tech.category}
                  </h3>
                  <ul className="space-y-2">
                    {tech.items.map((item) => (
                      <li key={item} className="text-gray-600 text-sm">
                        {item}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary">
        <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to start your project?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-blue-100">
              Let's discuss your requirements and build something amazing together.
            </p>
            <div className="mt-10">
              <Button asChild size="lg" className="bg-white text-primary hover:bg-gray-100">
                <Link href="/contact">Contact Us Today</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
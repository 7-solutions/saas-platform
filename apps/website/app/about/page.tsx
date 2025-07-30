import { MainLayout } from '../../components/layout';
import { Card } from '@saas-platform/ui';

export const metadata = {
  title: 'About Us - SaaS Platform',
  description: 'Learn about our mission to provide modern SaaS development tools and infrastructure.',
};

export default function AboutPage() {
  const team = [
    {
      name: 'John Doe',
      role: 'CEO & Founder',
      description: 'Passionate about building scalable SaaS solutions.',
      avatar: '👨‍💼',
    },
    {
      name: 'Jane Smith',
      role: 'CTO',
      description: 'Expert in modern web technologies and cloud architecture.',
      avatar: '👩‍💻',
    },
    {
      name: 'Mike Johnson',
      role: 'Lead Developer',
      description: 'Full-stack developer with expertise in TypeScript and Go.',
      avatar: '👨‍💻',
    },
  ];

  const values = [
    {
      title: 'Innovation',
      description: 'We constantly push the boundaries of what\'s possible with modern web technologies.',
      icon: '💡',
    },
    {
      title: 'Quality',
      description: 'We believe in delivering high-quality, well-tested, and maintainable code.',
      icon: '⭐',
    },
    {
      title: 'Community',
      description: 'We\'re committed to building tools that help the developer community thrive.',
      icon: '🤝',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              About Our Platform
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We're building the future of SaaS development with modern tools, 
              best practices, and a focus on developer experience.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:text-center">
            <h2 className="text-base font-semibold leading-7 text-primary">Our Mission</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Empowering developers to build better SaaS applications
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              We believe that building a SaaS application shouldn't require months of setup and configuration. 
              Our platform provides everything you need to get started quickly, from modern frontend frameworks 
              to scalable backend services and deployment infrastructure.
            </p>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Our Values
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              The principles that guide everything we do.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {values.map((value) => (
                <Card key={value.title} className="p-8 text-center">
                  <div className="text-4xl mb-4">{value.icon}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    {value.title}
                  </h3>
                  <p className="text-gray-600">
                    {value.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Meet Our Team
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              The passionate individuals behind our platform.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <div className="grid max-w-xl grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3">
              {team.map((member) => (
                <Card key={member.name} className="p-8 text-center">
                  <div className="text-6xl mb-4">{member.avatar}</div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {member.name}
                  </h3>
                  <p className="text-primary font-medium mb-4">
                    {member.role}
                  </p>
                  <p className="text-gray-600">
                    {member.description}
                  </p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
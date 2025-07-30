'use client';

import { MainLayout } from '../../components/layout';
import { Card } from '@saas-platform/ui';
import { ContactForm } from '../../components/contact/ContactForm';

export default function ContactPage() {

  const contactInfo = [
    {
      title: 'Email',
      value: 'hello@saasplatform.com',
      icon: '📧',
    },
    {
      title: 'Phone',
      value: '+1 (555) 123-4567',
      icon: '📞',
    },
    {
      title: 'Address',
      value: '123 Tech Street, San Francisco, CA 94105',
      icon: '📍',
    },
  ];

  return (
    <MainLayout>
      {/* Hero Section */}
      <section className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Get in Touch
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Ready to start your SaaS journey? We'd love to hear from you. 
              Send us a message and we'll respond as soon as possible.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form and Info Section */}
      <section className="bg-gray-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl lg:max-w-none">
            <div className="grid grid-cols-1 gap-x-8 gap-y-16 lg:grid-cols-2">
              {/* Contact Form */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-8">
                  Send us a message
                </h2>
                <ContactForm />
              </div>

              {/* Contact Information */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-8">
                  Contact Information
                </h2>
                <div className="space-y-6">
                  {contactInfo.map((info) => (
                    <Card key={info.title} className="p-6">
                      <div className="flex items-center">
                        <div className="text-2xl mr-4">{info.icon}</div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {info.title}
                          </h3>
                          <p className="text-gray-600">{info.value}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <div className="mt-12">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Business Hours
                  </h3>
                  <Card className="p-6">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monday - Friday</span>
                        <span className="text-gray-900">9:00 AM - 6:00 PM PST</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Saturday</span>
                        <span className="text-gray-900">10:00 AM - 4:00 PM PST</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sunday</span>
                        <span className="text-gray-900">Closed</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Have questions? We have answers.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl">
            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  How long does it take to build a SaaS platform?
                </h3>
                <p className="text-gray-600">
                  The timeline depends on the complexity of your requirements. A basic platform 
                  can be ready in 4-6 weeks, while more complex solutions may take 3-6 months.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Do you provide ongoing support?
                </h3>
                <p className="text-gray-600">
                  Yes, we offer comprehensive maintenance and support packages to ensure your 
                  platform stays up-to-date and performs optimally.
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Can you work with our existing team?
                </h3>
                <p className="text-gray-600">
                  Absolutely! We can collaborate with your in-house developers or work as an 
                  extension of your team to deliver the best results.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
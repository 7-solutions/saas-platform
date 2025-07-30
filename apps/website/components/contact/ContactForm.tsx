'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Input, Label } from '@saas-platform/ui';
import { useSubmitContactForm } from '@saas-platform/shared';
import { contactFormSchema, type ContactFormData } from '../../lib/validations/contact';

interface ContactFormProps {
  onSuccess?: () => void;
  className?: string;
}

export function ContactForm({ onSuccess, className }: ContactFormProps) {
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });

  const submitContactForm = useSubmitContactForm({
    onSuccess: (response) => {
      if (response.data) {
        setIsSubmitted(true);
        reset();
        onSuccess?.();
      }
    },
    onError: (error) => {
      console.error('Failed to submit contact form:', error);
    },
  });

  const onSubmit = async (data: ContactFormData, event?: React.BaseSyntheticEvent) => {
    try {
      // Basic spam protection - check honeypot field
      const formData = new FormData(event?.target);
      const honeypot = formData.get('website');
      
      if (honeypot) {
        // Silently reject spam submissions
        console.warn('Spam submission detected');
        return;
      }

      await submitContactForm.mutateAsync(data);
    } catch (error) {
      // Error is handled by the mutation's onError callback
    }
  };

  const handleSendAnother = () => {
    setIsSubmitted(false);
  };

  if (isSubmitted) {
    return (
      <Card className={`p-8 ${className || ''}`}>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Message Sent!
          </h3>
          <p className="text-gray-600 mb-4">
            Thank you for your message. We'll get back to you soon.
          </p>
          <Button onClick={handleSendAnother} className="mt-4">
            Send Another Message
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-8 ${className || ''}`}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              className="mt-2"
              {...register('name')}
              aria-invalid={errors.name ? 'true' : 'false'}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              className="mt-2"
              {...register('email')}
              aria-invalid={errors.email ? 'true' : 'false'}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>
        
        <div>
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            type="text"
            className="mt-2"
            {...register('company')}
            aria-invalid={errors.company ? 'true' : 'false'}
          />
          {errors.company && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.company.message}
            </p>
          )}
        </div>
        
        <div>
          <Label htmlFor="message">Message *</Label>
          <textarea
            id="message"
            rows={4}
            className="mt-2 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
            placeholder="Tell us about your project..."
            {...register('message')}
            aria-invalid={errors.message ? 'true' : 'false'}
          />
          {errors.message && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {errors.message.message}
            </p>
          )}
        </div>

        {/* Honeypot field for spam protection */}
        <div className="hidden">
          <label htmlFor="website">Website (leave blank)</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        {submitContactForm.error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">
              Failed to send message. Please try again or contact us directly.
            </div>
          </div>
        )}
        
        <Button 
          type="submit" 
          disabled={isSubmitting || submitContactForm.isPending}
          className="w-full"
        >
          {isSubmitting || submitContactForm.isPending ? 'Sending...' : 'Send Message'}
        </Button>
      </form>
    </Card>
  );
}
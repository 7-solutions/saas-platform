# @saas-platform/ui

A comprehensive UI component library built with React, TypeScript, Tailwind CSS, and shadcn/ui components.

## Features

- 🎨 **Modern Design System**: Built with Tailwind CSS and shadcn/ui design tokens
- 🔧 **TypeScript First**: Full type safety with comprehensive TypeScript support
- 📝 **Form Components**: React Hook Form integration with Zod validation
- 🔐 **Authentication Components**: Ready-to-use login forms and protected routes
- 📚 **Storybook Documentation**: Interactive component documentation
- 🎯 **Accessible**: Built with accessibility best practices

## Installation

```bash
pnpm add @saas-platform/ui
```

## Usage

### Basic Components

```tsx
import { Button, Input, Card } from '@saas-platform/ui';

function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter text..." />
      <Button>Click me</Button>
    </Card>
  );
}
```

### Form Components

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormInput, Button } from '@saas-platform/ui';

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
});

function MyForm() {
  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <FormInput
        control={control}
        name="email"
        label="Email"
        type="email"
        required
      />
      <FormInput
        control={control}
        name="name"
        label="Name"
        required
      />
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### Authentication Components

```tsx
import { LoginForm, ProtectedRoute } from '@saas-platform/ui';

function App() {
  const handleLogin = async (data) => {
    // Handle login logic
    console.log('Login:', data);
  };

  return (
    <div>
      <LoginForm onSubmit={handleLogin} />
      
      <ProtectedRoute user={currentUser}>
        <Dashboard />
      </ProtectedRoute>
    </div>
  );
}
```

## Styling

The library uses Tailwind CSS with custom design tokens. Make sure to include the CSS in your application:

```tsx
import '@saas-platform/ui/dist/styles/globals.css';
```

Or if you're using the source files:

```tsx
import '@saas-platform/ui/src/styles/globals.css';
```

## Available Components

### UI Components
- `Button` - Versatile button component with multiple variants
- `Input` - Form input with consistent styling
- `Label` - Accessible form labels
- `Card` - Container component with header, content, and footer
- `Alert` - Alert messages with different variants

### Form Components
- `FormField` - Generic form field wrapper
- `FormInput` - Input field with React Hook Form integration
- `FormTextarea` - Textarea field with form integration
- `FormSelect` - Select dropdown with form integration

### Authentication Components
- `LoginForm` - Complete login form with validation
- `ProtectedRoute` - Route protection with authentication checks
- `UserMenu` - User dropdown menu with profile actions

## Development

### Scripts

- `pnpm build` - Build the library
- `pnpm dev` - Watch mode for development
- `pnpm storybook` - Start Storybook development server
- `pnpm build-storybook` - Build Storybook for production
- `pnpm type-check` - Run TypeScript type checking
- `pnpm lint` - Run ESLint

### Storybook

View component documentation and examples:

```bash
pnpm storybook
```

This will start Storybook on `http://localhost:6006`.

## Design Tokens

The library includes a comprehensive design system with:

- Color palette with semantic naming
- Typography scale
- Spacing system
- Border radius values
- Animation keyframes

All design tokens are available as CSS custom properties and can be customized by overriding the values in your application.

## Contributing

1. Add new components in `src/components/`
2. Create corresponding stories in `*.stories.tsx` files
3. Export components from appropriate index files
4. Update this README with usage examples
5. Run tests and type checking before submitting

## License

Private package for SaaS Platform project.
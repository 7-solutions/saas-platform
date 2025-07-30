import type { Meta, StoryObj } from '@storybook/react';
import { LoginForm } from './login-form';

const meta: Meta<typeof LoginForm> = {
  title: 'Auth/LoginForm',
  component: LoginForm,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    onSubmit: async (data: any) => {
      console.log('Login attempt:', data);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
  },
};

export const Loading: Story = {
  args: {
    onSubmit: async (data: any) => {
      console.log('Login attempt:', data);
    },
    isLoading: true,
  },
};

export const WithError: Story = {
  args: {
    onSubmit: async (data: any) => {
      console.log('Login attempt:', data);
    },
    error: 'Invalid email or password. Please try again.',
  },
};

export const CustomTitle: Story = {
  args: {
    onSubmit: async (data: any) => {
      console.log('Login attempt:', data);
    },
    title: 'Admin Login',
    description: 'Enter your admin credentials to access the dashboard',
  },
};
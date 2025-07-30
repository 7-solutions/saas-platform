import type { Meta, StoryObj } from '@storybook/react';
import { useForm } from 'react-hook-form';
import { FormInput } from './form-input';
import { Button } from '../ui/button';

const meta: Meta<typeof FormInput> = {
  title: 'Forms/FormInput',
  component: FormInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const FormWrapper = ({ children, ...args }: any) => {
  const { control, handleSubmit } = useForm({
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  });

  return (
    <form onSubmit={handleSubmit((data) => console.log(data))} className="space-y-4 w-80">
      {children}
      <Button type="submit">Submit</Button>
    </form>
  );
};

export const Default: Story = {
  render: (args) => {
    const { control } = useForm({ defaultValues: { email: '' } });
    return (
      <FormWrapper>
        <FormInput
          {...args}
          control={control}
          name="email"
          label="Email"
          placeholder="Enter your email"
        />
      </FormWrapper>
    );
  },
};

export const Required: Story = {
  render: (args) => {
    const { control } = useForm({ defaultValues: { email: '' } });
    return (
      <FormWrapper>
        <FormInput
          {...args}
          control={control}
          name="email"
          label="Email"
          placeholder="Enter your email"
          required
        />
      </FormWrapper>
    );
  },
};

export const WithDescription: Story = {
  render: (args) => {
    const { control } = useForm({ defaultValues: { email: '' } });
    return (
      <FormWrapper>
        <FormInput
          {...args}
          control={control}
          name="email"
          label="Email"
          placeholder="Enter your email"
          description="We'll never share your email with anyone else."
        />
      </FormWrapper>
    );
  },
};

export const Password: Story = {
  render: (args) => {
    const { control } = useForm({ defaultValues: { password: '' } });
    return (
      <FormWrapper>
        <FormInput
          {...args}
          control={control}
          name="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          required
        />
      </FormWrapper>
    );
  },
};
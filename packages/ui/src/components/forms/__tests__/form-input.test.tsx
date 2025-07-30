import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { FormInput } from '../form-input';

// Test wrapper component
const TestFormInput = ({ 
  name = 'test', 
  label = 'Test Label',
  ...props 
}: any) => {
  const { control } = useForm();
  return (
    <FormInput
      name={name}
      label={label}
      control={control}
      {...props}
    />
  );
};

describe('FormInput', () => {
  it('renders with label', () => {
    render(<TestFormInput />);
    expect(screen.getByLabelText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Label')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    render(<TestFormInput required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('displays help text when provided', () => {
    render(<TestFormInput helpText="This is help text" />);
    expect(screen.getByText('This is help text')).toBeInTheDocument();
  });

  it('handles different input types', () => {
    const { rerender } = render(<TestFormInput type="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

    rerender(<TestFormInput type="password" />);
    const passwordInput = screen.getByLabelText('Test Label');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('can be disabled', () => {
    render(<TestFormInput disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies custom placeholder', () => {
    render(<TestFormInput placeholder="Enter your text" />);
    expect(screen.getByPlaceholderText('Enter your text')).toBeInTheDocument();
  });
});
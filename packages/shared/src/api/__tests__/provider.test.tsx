import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { ApiProvider, useApiContext, useAuth } from '../provider';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Test component that uses the API context
function TestComponent() {
  const { client, isAuthenticated } = useApiContext();
  const { login, logout } = useAuth();

  return (
    <div>
      <div data-testid="authenticated">{isAuthenticated.toString()}</div>
      <div data-testid="client-exists">{(!!client).toString()}</div>
      <button 
        data-testid="login-btn" 
        onClick={() => login('access-token', 'refresh-token')}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

describe('ApiProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  it('should provide API client context', () => {
    render(
      <ApiProvider>
        <TestComponent />
      </ApiProvider>
    );

    expect(screen.getByTestId('client-exists')).toHaveTextContent('true');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('should restore authentication from localStorage', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'stored-access-token';
      if (key === 'refresh_token') return 'stored-refresh-token';
      return null;
    });

    render(
      <ApiProvider>
        <TestComponent />
      </ApiProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('access_token');
    expect(localStorageMock.getItem).toHaveBeenCalledWith('refresh_token');
  });

  it('should handle login', () => {
    render(
      <ApiProvider>
        <TestComponent />
      </ApiProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');

    act(() => {
      screen.getByTestId('login-btn').click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('access_token', 'access-token');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token');
  });

  it('should handle logout', () => {
    localStorageMock.getItem.mockImplementation((key) => {
      if (key === 'access_token') return 'stored-access-token';
      if (key === 'refresh_token') return 'stored-refresh-token';
      return null;
    });

    render(
      <ApiProvider>
        <TestComponent />
      </ApiProvider>
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

    act(() => {
      screen.getByTestId('logout-btn').click();
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('access_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('refresh_token');
  });

  it('should throw error when useApiContext is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow('useApiContext must be used within an ApiProvider');

    consoleSpy.mockRestore();
  });

  it('should accept custom configuration', () => {
    const customConfig = {
      baseUrl: 'https://custom-api.example.com',
      onTokenRefresh: vi.fn(),
    };

    render(
      <ApiProvider config={customConfig}>
        <TestComponent />
      </ApiProvider>
    );

    expect(screen.getByTestId('client-exists')).toHaveTextContent('true');
  });
});
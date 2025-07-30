import React from 'react';
import { render } from '@testing-library/react';
// Add any providers that your components need
const AllTheProviders = ({ children }) => {
    return (<div className="min-h-screen bg-background font-sans antialiased">
      {children}
    </div>);
};
const customRender = (ui, options) => render(ui, { wrapper: AllTheProviders, ...options });
export * from '@testing-library/react';
export { customRender as render };

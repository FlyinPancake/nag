import { ReactElement, ReactNode } from "react";
import { render, RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a new QueryClient for each test to ensure isolation
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Disable retries in tests for faster failures
        retry: false,
        // Don't refetch on window focus in tests
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

// Wrapper component with all providers needed for testing
function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Custom render function that wraps components with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Re-export everything from testing-library
export * from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";

// Override render with our custom version
export { customRender as render };

// Export utilities for more advanced test scenarios
export { createTestQueryClient };

// Wrapper for testing hooks that need QueryClient
export function createWrapper() {
  const queryClient = createTestQueryClient();
  return function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

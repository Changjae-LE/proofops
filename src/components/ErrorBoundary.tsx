import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Top-level error boundary. Shows a user-friendly message and logs technical details to
 * the console only (never to the network), since the failure could occur while sensitive
 * incident data is in memory.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("ProofOps encountered an unexpected error:", error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="error-boundary" role="alert">
          <h2>Something went wrong</h2>
          <p>
            ProofOps hit an unexpected error and stopped to avoid showing incorrect results. No
            evidence was sent anywhere.
          </p>
          <button type="button" onClick={this.handleReset}>
            Reset application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

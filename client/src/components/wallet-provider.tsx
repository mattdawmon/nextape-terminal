import { type ReactNode, Component } from "react";
import { WalletProvider as WalletProviderInner } from "@/lib/wallet";

interface ErrorBoundaryState {
  hasError: boolean;
}

class WalletErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("WalletProvider error (non-critical):", error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WalletErrorBoundary fallback={children}>
      <WalletProviderInner>
        {children}
      </WalletProviderInner>
    </WalletErrorBoundary>
  );
}

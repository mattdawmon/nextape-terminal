import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/i18n";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallbackUI({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const { t } = useTranslation();

  return (
    <Card className="flex flex-col items-center justify-center p-6 m-4 text-center" data-testid="error-boundary-fallback">
      <AlertTriangle className="w-8 h-8 text-warning mb-3" />
      <p className="text-sm font-medium mb-1">{t.errors.somethingWrong}</p>
      <p className="text-[10px] text-muted-foreground mb-3 max-w-xs font-mono">
        {error?.message || "An unexpected error occurred"}
      </p>
      <Button size="sm" variant="outline" onClick={onReset} data-testid="button-error-retry">
        <RefreshCw className="w-3 h-3 mr-1.5" />
        {t.errors.tryAgain}
      </Button>
    </Card>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[ErrorBoundary${this.props.label ? ` - ${this.props.label}` : ""}]`, error.message);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallbackUI error={this.state.error} onReset={this.handleReset} />
      );
    }

    return this.props.children;
  }
}

export function PanelErrorFallback({ label }: { label?: string }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-4" data-testid="panel-error-fallback">
      <AlertTriangle className="w-6 h-6 mb-2 opacity-30" />
      <p className="text-[10px]">{label || t.errors.somethingWrong}</p>
    </div>
  );
}

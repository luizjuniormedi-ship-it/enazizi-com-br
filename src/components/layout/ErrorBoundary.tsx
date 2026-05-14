import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isChunkLoadError } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
  /** Optional fallback UI instead of default error screen */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  componentDidMount() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(this.getChunkReloadKey());
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.tryAutoRecoverChunkError(error)) {
      return;
    }

    console.warn("[ErrorBoundary] Erro capturado:", error.message);
    // Silent log — no stack traces exposed to user
  }

  getChunkReloadKey = () => `enazizi_chunk_reload:${window.location.pathname}`;

  tryAutoRecoverChunkError = (error: Error) => {
    if (typeof window === "undefined" || !isChunkLoadError(error)) {
      return false;
    }

    const retryKey = this.getChunkReloadKey();
    const hasRetried = sessionStorage.getItem(retryKey) === "1";

    if (hasRetried) {
      return false;
    }

    sessionStorage.setItem(retryKey, "1");
    window.location.reload();
    return true;
  };

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    // Force a full reload when going home to clear any corrupted JS state
    window.location.href = "/dashboard?recovered=1";
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const canRetry = this.state.retryCount < 2;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">Algo deu errado</h2>
              <p className="text-sm text-muted-foreground">
                Ocorreu um erro inesperado. {canRetry ? "Tente novamente." : "Recarregue a página."}
              </p>
            </div>
            <div className="flex gap-3 justify-center">
              {canRetry ? (
                <Button onClick={this.handleRetry} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Tentar Novamente
                </Button>
              ) : (
                <Button onClick={this.handleReload} className="gap-2">
                  <RefreshCw className="w-4 h-4" />
                  Recarregar
                </Button>
              )}
              <Button variant="outline" onClick={this.handleGoHome} className="gap-2">
                <Home className="w-4 h-4" />
                Ir ao Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    // Log to Supabase for monitoring - using any to bypass type issues with dynamically added table
    this.logError(error, errorInfo);
  }

  private async logError(error: Error, errorInfo: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await (supabase as any).from('error_log').insert({
        error_message: error.message,
        stack_trace: error.stack,
        component_stack: errorInfo.componentStack,
        user_id: user?.id,
        severity: 'critical',
        context: {
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      });
      if (dbError) console.error('Supabase logging error:', dbError);
    } catch (e) {
      console.error('Failed to log error to Supabase:', e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-background p-4 text-center">
          <div className="max-w-md space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Algo deu errado.</h1>
            <p className="text-muted-foreground">
              Ocorreu um erro inesperado. Nossa equipe técnica foi notificada.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Global Rejection Handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // Log to Supabase using any
  (supabase as any).from('error_log').insert({
    error_message: `Unhandled Rejection: ${event.reason?.message || event.reason}`,
    stack_trace: event.reason?.stack,
    severity: 'warning',
    context: {
      url: window.location.href,
      type: 'unhandled_rejection'
    }
  }).then(({ error }: any) => {
    if (error) console.error('Failed to log unhandled rejection:', error);
  });
});

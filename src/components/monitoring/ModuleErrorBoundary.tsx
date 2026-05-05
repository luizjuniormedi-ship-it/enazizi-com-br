import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  children: ReactNode;
  module: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ModuleErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[ModuleErrorBoundary] Error in module ${this.props.module}:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 m-4 rounded-2xl border border-destructive/20 bg-destructive/5 text-center space-y-4 animate-fade-in">
          <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-bold">Erro no módulo {this.props.module}</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Ocorreu uma falha inesperada ao renderizar este componente.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => this.setState({ hasError: false })}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </Button>
            <Button 
              variant="default" 
              size="sm" 
              onClick={() => window.location.href = "/dashboard"}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Voltar ao Início
            </Button>
          </div>
          {(process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') && (
            <pre className="mt-4 p-4 rounded bg-black/50 text-[10px] text-left overflow-auto max-w-full text-red-400 select-all">
              {this.state.error?.message}
              {"\n"}
              {this.state.error?.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

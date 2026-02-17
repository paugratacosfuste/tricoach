import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    private handleReset = () => {
        // Clear all localStorage data
        localStorage.clear();
        // Sign out and reload
        window.location.href = '/login';
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-background p-4">
                    <div className="max-w-md w-full text-center space-y-6">
                        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="w-8 h-8 text-destructive" />
                        </div>

                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
                            <p className="text-muted-foreground">
                                An unexpected error occurred. You can try reloading the page or resetting the app data.
                            </p>
                        </div>

                        {this.state.error && (
                            <div className="bg-muted p-3 rounded-lg text-left">
                                <p className="text-xs font-mono text-muted-foreground truncate">
                                    {this.state.error.message}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleReload}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={this.handleReset}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive/10 text-destructive rounded-lg font-medium hover:bg-destructive/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Reset App Data
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

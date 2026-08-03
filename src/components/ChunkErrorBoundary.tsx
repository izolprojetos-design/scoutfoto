import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { isChunkLoadError, reportChunkError } from "@/lib/lazyWithRetry";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
  error: Error | null;
}

/**
 * Catches errors in lazy-loaded route components, including the typical
 * "Failed to fetch dynamically imported module" thrown when chunks
 * become stale after deploys.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, isChunkError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isChunkError: isChunkLoadError(error), error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ChunkErrorBoundary]", error);
    if (isChunkLoadError(error)) {
      reportChunkError({
        type: "ChunkLoadError",
        message: String(error?.message || error),
        route: typeof window !== "undefined" ? window.location.pathname : "",
        retries: 0,
        willReload: false,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      });
    }
  }

  handleReload = () => {
    try { sessionStorage.removeItem("__chunk_retry_reloaded__"); } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <h2 className="text-xl font-semibold">
          {this.state.isChunkError ? "Atualização disponível" : "Algo deu errado"}
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          {this.state.isChunkError
            ? "Não foi possível carregar esta página. Isso geralmente acontece após uma atualização do app. Recarregue para continuar."
            : "Encontramos um problema ao abrir esta página. Tente recarregar."}
        </p>
        <Button onClick={this.handleReload} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Recarregar
        </Button>
      </div>
    );
  }
}

export default ChunkErrorBoundary;

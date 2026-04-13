import { useIsFetching } from "@tanstack/react-query";
import { CloudOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DataFreshnessIndicator = () => {
  const isFetching = useIsFetching();
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (isFetching > 0) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Atualizando dados…</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  if (!isOnline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-amber-500">
            <CloudOff className="h-3.5 w-3.5" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Offline — dados do cache local</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">Dados atualizados</p>
      </TooltipContent>
    </Tooltip>
  );
};

export default DataFreshnessIndicator;
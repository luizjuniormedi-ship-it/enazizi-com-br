import React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const InfoTooltip = ({ content, className }: { content: React.ReactNode, className?: string }) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex cursor-help ${className}`}>
          <Info className="h-3 w-3 text-muted-foreground hover:text-primary transition-colors" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[250px] p-3 text-xs bg-popover text-popover-foreground border shadow-lg">
        {content}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

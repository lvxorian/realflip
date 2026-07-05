import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center py-12 px-6", className)}>
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card border border-border/50 text-muted mb-4">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-muted mb-1">{title}</p>
      {description && (
        <p className="text-xs text-muted/50 max-w-[200px]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

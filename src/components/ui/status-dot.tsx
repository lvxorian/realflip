import { cn } from "@/lib/utils";

interface StatusDotProps {
  status?: "active" | "idle" | "error" | "success";
  className?: string;
}

const colors = {
  active: "bg-accent shadow-[0_0_6px_rgba(16,185,129,0.4)]",
  idle: "bg-muted",
  error: "bg-danger shadow-[0_0_6px_rgba(239,68,68,0.4)]",
  success: "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)]",
};

export function StatusDot({ status = "idle", className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        status === "active" && "pulse-dot",
        colors[status],
        className
      )}
    />
  );
}

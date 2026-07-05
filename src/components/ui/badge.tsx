import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent-soft text-accent border border-accent/20",
        secondary: "bg-card text-muted border border-border/50",
        success: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
        warning: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
        danger: "bg-red-500/10 text-red-400 border border-red-500/20",
        info: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
        outline: "bg-transparent text-muted border border-border",
        score: "bg-card text-foreground border border-border/50 font-mono",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px]",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  score?: number;
}

function Badge({ className, variant, size, score, ...props }: BadgeProps) {
  if (variant === "score" && score !== undefined) {
    let colorClass = "text-red-400 border-red-500/20 bg-red-500/10";
    if (score >= 80) colorClass = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
    else if (score >= 60) colorClass = "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
    else if (score >= 40) colorClass = "text-amber-400 border-amber-500/20 bg-amber-500/10";

    return (
      <span
        className={cn(badgeVariants({ variant: "score", size }), colorClass, className)}
        {...props}
      >
        {score}
      </span>
    );
  }

  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };

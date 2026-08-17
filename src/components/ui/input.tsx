import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { cn, formatAmountInput } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helper, id, type, onChange, value, autoComplete, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const isAmount = type === "amount";

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      if (!isAmount) {
        onChange?.(e);
        return;
      }
      // type="amount": value předáme dál jen s číslicemi (mezery jsou jen formátování)
      const digits = e.target.value.replace(/\D/g, "");
      onChange?.({ ...e, target: { ...e.target, value: digits } });
    };

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-foreground/80"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type={isAmount ? "text" : type}
          inputMode={isAmount ? "numeric" : undefined}
          autoComplete={isAmount ? "off" : autoComplete}
          value={isAmount ? formatAmountInput(value as string | number | undefined) : value}
          onChange={handleChange}
          className={cn(
            "flex h-10 w-full rounded-lg border bg-card px-3 py-2 text-sm",
            "placeholder:text-muted/50",
            "focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            error ? "border-danger" : "border-border",
            className
          )}
          {...props}
        />
        {helper && !error && (
          <p className="text-xs text-muted">{helper}</p>
        )}
        {error && (
          <p className="text-xs text-danger">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };

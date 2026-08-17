import { forwardRef, type ChangeEvent, type InputHTMLAttributes } from "react";
import { formatAmountInput } from "@/lib/utils";

export interface AmountInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> {
  value: number | string | null | undefined;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Částkový vstup: type="text" + inputMode="numeric", který živě formátuje
 * mezery jako oddělovače tisíců — „5000000" se při psaní ukazuje jako
 * „5 000 000". onChange dostane event s value = jen číslice, takže stávající
 * parsování (Number / parseInt / parseAmountInput) funguje beze změny.
 */
const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(
  ({ value, onChange, className, ...props }, ref) => (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={formatAmountInput(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        onChange?.({
          ...e,
          target: { ...e.target, value: digits },
        });
      }}
      className={className}
      {...props}
    />
  )
);

AmountInput.displayName = "AmountInput";

export { AmountInput };

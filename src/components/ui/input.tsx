import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  rightIcon?: ReactNode;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, rightIcon, error, className, id, ...props },
  ref,
) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="mb-2 block text-sm font-medium whitespace-nowrap text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-12 w-full rounded-lg border border-gray-300 bg-background-card px-4 text-base text-text-primary placeholder:text-text-tertiary focus:border-primary focus:outline-none",
            rightIcon && "pr-12",
            error && "border-error",
            className,
          )}
          {...props}
        />
        {rightIcon && <div className="absolute top-1/2 right-4 -translate-y-1/2">{rightIcon}</div>}
      </div>
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
});

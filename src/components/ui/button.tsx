import { ButtonHTMLAttributes, CSSProperties } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
};

const VARIANT_CLASS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-text-on-primary font-semibold active:bg-primary-dark",
  outline: "border border-gray-300 bg-transparent text-text-primary active:bg-background-elevated",
  ghost: "bg-transparent text-text-secondary active:bg-background-elevated",
  danger: "border border-error/40 bg-error/10 text-error active:bg-error/20",
};

// Sizing lives in plain inline styles, not Tailwind utilities — this
// sidesteps any environment where calc()/CSS-custom-property-based
// utilities (h-12, px-5, rounded-full, etc.) fail to resolve, which has
// been observed turning this button into a tiny circle with overflowing
// text in some preview contexts. Inline styles always win and never
// depend on a stylesheet loading correctly.
const SIZE_STYLE: Record<NonNullable<ButtonProps["size"]>, CSSProperties> = {
  sm: { height: 40, paddingLeft: 16, paddingRight: 16, fontSize: 14 },
  md: { height: 48, paddingLeft: 20, paddingRight: 20, fontSize: 16 },
};

const BASE_STYLE: CSSProperties = {
  // Explicitly neutralize native OS/browser button chrome — some
  // browsers/WebViews apply their own rounded button appearance that
  // ignores width/padding unless appearance is reset. Belt-and-suspenders
  // alongside the explicit sizing below.
  WebkitAppearance: "none",
  appearance: "none",
  boxSizing: "border-box",
  outline: "none",
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  whiteSpace: "nowrap",
  borderRadius: 9999,
  fontWeight: 500,
  transition: "opacity 0.15s ease",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  style,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled}
      style={{
        ...BASE_STYLE,
        ...SIZE_STYLE[size],
        ...(disabled ? { cursor: "not-allowed", opacity: 0.5 } : { cursor: "pointer" }),
        ...style,
      }}
      className={cn(VARIANT_CLASS[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

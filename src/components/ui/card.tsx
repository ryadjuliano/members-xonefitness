import { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  highlight?: boolean;
};

/**
 * GCard clone — the single most-reused surface in BomberGym. Bordered,
 * rounded, drop-shadowed container. `highlight` swaps in the dark-green
 * tinted variant used for the membership status card and digital card.
 */
export function Card({ className, highlight, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border shadow-card",
        highlight ? "border-primary/30 bg-card-highlight" : "border-gray-200 bg-background-card",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

type CardButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  highlight?: boolean;
};

export function CardButton({ className, highlight, children, ...props }: CardButtonProps) {
  return (
    <button
      className={cn(
        "rounded-lg border text-left shadow-card transition-opacity active:opacity-70",
        highlight ? "border-primary/30 bg-card-highlight" : "border-gray-200 bg-background-card",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

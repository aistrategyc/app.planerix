"use client";
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export type ButtonSize = "sm" | "md" | "lg";
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      asChild = false,
      size = "md",
      variant = "primary",
      loading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const base =
      "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const sizes: Record<ButtonSize, string> = {
      sm: "px-3 py-2 text-sm",
      md: "px-4 py-2 text-sm",
      lg: "px-6 py-3 text-base",
    };

    const variants: Record<ButtonVariant, string> = {
      primary:
        "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600",
      secondary:
        "bg-white text-blue-700 border border-blue-600 hover:bg-blue-50 focus-visible:ring-blue-600",
      outline:
        "border border-gray-300 text-gray-900 hover:bg-gray-50 focus-visible:ring-blue-600",
      ghost:
        "text-blue-700 hover:bg-blue-50 focus-visible:ring-blue-600",
      danger:
        "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
    };

    return (
      <Comp
        ref={ref}
        className={cn(base, sizes[size], variants[variant], className)}
        aria-busy={loading || undefined}
        data-loading={loading ? "true" : undefined}
        disabled={disabled || loading}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
export default Button;
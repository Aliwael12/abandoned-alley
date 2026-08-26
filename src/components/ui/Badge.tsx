import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & {
  variant?: "neutral" | "accent" | "outline";
};

export default function Badge({ variant = "neutral", className = "", ...rest }: Props) {
  return <span className={`aa-badge aa-badge--${variant} ${className}`} {...rest} />;
}

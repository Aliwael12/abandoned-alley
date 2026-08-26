import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export default function Card({ interactive, className = "", ...rest }: Props) {
  return (
    <div
      className={`aa-card ${interactive ? "aa-card--interactive" : ""} ${className}`}
      {...rest}
    />
  );
}

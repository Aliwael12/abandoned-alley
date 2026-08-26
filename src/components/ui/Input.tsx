import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  error?: boolean;
};

export default function Input({ error, className = "", ...rest }: Props) {
  return (
    <input
      className={`aa-input ${error ? "aa-input--error" : ""} ${className}`}
      {...rest}
    />
  );
}

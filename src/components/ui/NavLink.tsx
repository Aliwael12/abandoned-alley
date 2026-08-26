import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  active?: boolean;
};

export default function NavLink({ href, active, className = "", ...rest }: Props) {
  return (
    <Link
      href={href}
      data-active={active ? "true" : undefined}
      className={`aa-nav-link ${className}`}
      {...rest}
    />
  );
}

"use client";

import Image from "next/image";

type Props = {
  size?: number;
  /** Kept for API compatibility with previous 3D version. Unused. */
  rotationSpeed?: string;
  /** Kept for API compatibility with previous 3D version. Unused. */
  controls?: boolean;
};

export default function Logo3D({ size = 150 }: Props) {
  return (
    <div
      className="grid place-items-center relative"
      style={{ width: size, height: size }}
      aria-label="Abandoned Alley logo"
    >
      <Image
        src="/media/logo-aa.png"
        alt="Abandoned Alley"
        width={size}
        height={size}
        priority
        unoptimized
        className="object-contain select-none pointer-events-none"
        draggable={false}
      />
    </div>
  );
}

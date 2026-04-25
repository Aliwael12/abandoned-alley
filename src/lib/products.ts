export type ProductOption = {
  name: string;
  values: string[];
};

export type ProductVariant = {
  id: string;
  title: string;
  price: number;
  options: Record<string, string>;
};

export type Media =
  | { type: "image"; src: string; alt?: string }
  | { type: "video"; src: string; poster?: string };

export type Product = {
  handle: string;
  title: string;
  vendor: string;
  description: string;
  price: number;
  media: Media[];
  options: ProductOption[];
  variants: ProductVariant[];
  collection: string;
};

export const products: Product[] = [
  {
    handle: "black-ddw-tee",
    title: "Black DDW Tee",
    vendor: "Abandoned Alley",
    collection: "dont-die-wondering",
    description:
      "Heavyweight black cut-off tee with a hand-printed DON'T DIE WONDERING graphic in red and gold. Boxy unisex fit, raw armholes, garment-washed for that lived-in feel. Made for late nights and long rides.",
    price: 65,
    media: [
      { type: "image", src: "/media/black-ddw-1.jpg", alt: "Black DDW Tee — squat" },
      { type: "image", src: "/media/black-ddw-2.jpg", alt: "Black DDW Tee — full" },
      { type: "image", src: "/media/black-ddw-3.jpg", alt: "Black DDW Tee — composite" },
      { type: "video", src: "/media/black-ddw.mp4", poster: "/media/black-ddw-1.jpg" },
    ],
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    variants: [
      { id: "bddw-s", title: "S", price: 65, options: { Size: "S" } },
      { id: "bddw-m", title: "M", price: 65, options: { Size: "M" } },
      { id: "bddw-l", title: "L", price: 65, options: { Size: "L" } },
      { id: "bddw-xl", title: "XL", price: 65, options: { Size: "XL" } },
    ],
  },
  {
    handle: "white-ddw-tee",
    title: "White DDW Tee",
    vendor: "Abandoned Alley",
    collection: "dont-die-wondering",
    description:
      "Vintage cream cut-off with the DON'T DIE WONDERING print in faded red and gold. 100% heavyweight cotton, sun-bleached and stone-washed for an authentic worn-in look. The everyday tee for the everyday riot.",
    price: 65,
    media: [
      { type: "image", src: "/media/white-ddw-1.jpg", alt: "White DDW Tee — front" },
      { type: "image", src: "/media/white-ddw-2.jpg", alt: "White DDW Tee — composite" },
      { type: "video", src: "/media/white-ddw.mp4", poster: "/media/white-ddw-1.jpg" },
    ],
    options: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    variants: [
      { id: "wddw-s", title: "S", price: 65, options: { Size: "S" } },
      { id: "wddw-m", title: "M", price: 65, options: { Size: "M" } },
      { id: "wddw-l", title: "L", price: 65, options: { Size: "L" } },
      { id: "wddw-xl", title: "XL", price: 65, options: { Size: "XL" } },
    ],
  },
];

export function getProduct(handle: string) {
  return products.find((p) => p.handle === handle);
}

export const collections = [
  {
    handle: "dont-die-wondering",
    title: "DON'T DIE WONDERING",
    count: 2,
    image: "/media/black-ddw-3.jpg",
  },
];

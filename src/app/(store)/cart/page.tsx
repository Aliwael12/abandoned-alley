import CartContent from "@/components/CartContent";
import RegionGate from "@/components/RegionGate";

export const metadata = { title: "Your bag — Abandoned Alley" };

export default function CartPage() {
  return (
    <RegionGate>
      <CartContent />
    </RegionGate>
  );
}

import CartContent from "@/components/CartContent";
import RegionGate from "@/components/RegionGate";
import { isCardCheckoutEnabled } from "@/lib/stripe-server";

export const metadata = { title: "Your bag — Abandoned Alley" };

export default async function CartPage() {
  // Decided on the server, where /api/checkout makes the same call, so the
  // checkout form never promises a payment step the API won't take.
  const cardPayments = await isCardCheckoutEnabled();
  return (
    <RegionGate>
      <CartContent cardPayments={cardPayments} />
    </RegionGate>
  );
}

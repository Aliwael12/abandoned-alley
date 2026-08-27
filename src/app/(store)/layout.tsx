import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PinAnimation from "@/components/PinAnimation";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PinAnimation />
      <Header />
      {/* Explicit z-index (not `auto`) so this creates a stacking context and
          lifts all page content above the fixed pin layer behind it. */}
      <main className="relative" style={{ zIndex: 1 }}>
        {children}
      </main>
      <Footer />
    </>
  );
}

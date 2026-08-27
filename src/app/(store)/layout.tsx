import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PinAnimation from "@/components/PinAnimation";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PinAnimation />
      <Header />
      <main className="relative">{children}</main>
      <Footer />
    </>
  );
}

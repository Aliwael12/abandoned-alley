import type { Metadata } from "next";
import { Bebas_Neue, Rajdhani, Audiowide, Permanent_Marker } from "next/font/google";
import "./globals.css";
import LightningBackground from "@/components/LightningBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RunningText from "@/components/RunningText";
import MusicPlayer from "@/components/MusicPlayer";
import PageLoader from "@/components/PageLoader";

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});
const rajdhani = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-rajdhani",
  display: "swap",
});
const audiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-audiowide",
  display: "swap",
});
const marker = Permanent_Marker({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-marker",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Abandoned Alley",
  description: "Abandoned Alley — premium streetwear & accessories",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${rajdhani.variable} ${audiowide.variable} ${marker.variable}`}
    >
      <body>
        <LightningBackground />
        <PageLoader />
        <RunningText />
        <Header />
        <main className="relative">{children}</main>
        <MusicPlayer />
        <Footer />
      </body>
    </html>
  );
}

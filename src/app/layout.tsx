import type { Metadata } from "next";
import { Bebas_Neue, Rajdhani, Audiowide, Permanent_Marker } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import LightningBackground from "@/components/LightningBackground";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RunningText from "@/components/RunningText";
import MusicPlayer from "@/components/MusicPlayer";
import PageLoader from "@/components/PageLoader";
import SessionTracker from "@/components/SessionTracker";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

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

const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "840826755733594";
const META_PIXEL_IDS = Array.from(new Set([META_PIXEL_ID, "1563567275028054"].filter(Boolean)));

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${rajdhani.variable} ${audiowide.variable} ${marker.variable}`}
    >
      <body>
        {META_PIXEL_IDS.length > 0 && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
${META_PIXEL_IDS.map((id) => `fbq('init', '${id}');`).join("\n")}
fbq('track', 'PageView');`}
            </Script>
            <noscript>
              {META_PIXEL_IDS.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={id}
                  height="1"
                  width="1"
                  style={{ display: "none" }}
                  alt=""
                  src={`https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1`}
                />
              ))}
            </noscript>
          </>
        )}
        <LightningBackground />
        <PageLoader />
        <RunningText />
        <Header />
        <main className="relative">{children}</main>
        <MusicPlayer />
        <Footer />
        <SessionTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import localFont from "next/font/local";
import { Audiowide, Space_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SessionTracker from "@/components/SessionTracker";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const anton = localFont({
  src: "./fonts/anton.ttf",
  weight: "400",
  variable: "--font-anton",
  display: "swap",
});
const pragmatica = localFont({
  src: [
    { path: "./fonts/Pragmatica.woff2" },
    { path: "./fonts/Pragmatica.woff" },
    { path: "./fonts/Pragmatica.ttf" },
  ],
  weight: "400",
  variable: "--font-pragmatica",
  display: "swap",
});
const audiowide = Audiowide({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-audiowide",
  display: "swap",
});
const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
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
      className={`${anton.variable} ${pragmatica.variable} ${audiowide.variable} ${spaceMono.variable}`}
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
        {children}
        <SessionTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

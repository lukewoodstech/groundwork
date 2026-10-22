import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const TAGLINE = "See where you've been. Know where to go.";
const DESCRIPTION = `${TAGLINE} A map of six months of walked streets in your area, and a plan for today.`;

// Absolute URLs for the social image. Vercel sets the production host.
const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: "Groundwork",
  description: DESCRIPTION,
  applicationName: "Groundwork",
  openGraph: {
    type: "website",
    siteName: "Groundwork",
    title: "Groundwork",
    description: TAGLINE,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Groundwork: walked streets in Edgemont, Provo, glowing amber and blue on a dark map." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Groundwork",
    description: TAGLINE,
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/google-analytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.skope.network"),
  title: "Skope, consent dashboard",
  description:
    "Set up DPDP consent in 30 minutes. Bilingual banner, purpose-wise consent, audit-proof records.",
  robots: { index: false, follow: false },
  icons: { icon: "/logo.png", apple: "/logo.png" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Providers } from "./providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { template: "%s · Doctor Tracker", default: "Doctor Tracker" },
  description: "Track doctors, their patients and admissions.",
};

// Matches the light/dark page background so the mobile browser chrome blends in.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fbfb" },
    { media: "(prefers-color-scheme: dark)", color: "#090c0d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Set by proxy.ts; next-themes' inline theme script needs it to pass the CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    // next-themes sets the theme class before hydration, which React would otherwise flag.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers nonce={nonce}>{children}</Providers>
      </body>
    </html>
  );
}

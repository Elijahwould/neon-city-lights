import type { Metadata, Viewport } from "next";
import { Outfit, Oxanium } from "next/font/google";
import { Shell } from "@/components/shell";
import "./globals.css";

const body = Outfit({ subsets: ["latin"], variable: "--font-body" });
const display = Oxanium({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Neon City Lights",
  description: "A free companion for Neon City Lights: compendium, character builder, and printable sheet.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07060c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${body.variable} ${display.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono, Patrick_Hand } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const patrickHand = Patrick_Hand({
  weight: "400",
  variable: "--font-hand",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Graphics Board",
  description:
    "Pressure-sensitive whiteboard for graphics tablets. Pen, highlighter, shapes, laser pointer, screen recording and PNG export.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${patrickHand.variable} h-full antialiased`}
    >
      <body className="h-full">{children}</body>
    </html>
  );
}

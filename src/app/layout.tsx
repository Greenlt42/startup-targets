import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// verygoodfilms uses "Untitled Sans", a commercial Klim Type Foundry face —
// its webfont files were scraped from their live site and can't be
// redistributed here. Inter is the closest freely-licensed match in the
// same humanist-grotesk family.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Startup Targets",
  description: "Newly-funded startups worth a recruiting outreach message",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}

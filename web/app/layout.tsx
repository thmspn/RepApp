import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepApp · The BME common room",
  description:
    "Your voice, a little louder. Anonymous conversations with your Waterloo BME academic reps.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

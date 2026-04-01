import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kailash Command",
  description: "Mission Control Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-full">{children}</body>
    </html>
  );
}

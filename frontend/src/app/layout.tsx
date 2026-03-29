import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SmartTable OS",
  description: "Digital restaurant operating system for menus, orders, kitchen, analytics, and AI upsells.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "SmartTable OS",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-canvas text-ink antialiased">{children}</body>
    </html>
  );
}

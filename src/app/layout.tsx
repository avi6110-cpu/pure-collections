import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PURE COLLECTIONS",
  description: "מערכת ניהול אוספים",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}

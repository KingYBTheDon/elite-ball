import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Elite Ball Knowledge",
  description:
    "Name the most obscure NBA player for a team and a decade. The deeper the cut, the higher you score.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

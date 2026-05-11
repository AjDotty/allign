import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import MainWrapper from "@/components/MainWrapper";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Allign",
  description: "Sports academy management by Dottedline",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full" style={{ fontFamily: 'Inter, sans-serif' }}>
        <Sidebar />
        <MainWrapper>{children}</MainWrapper>
      </body>
    </html>
  );
}

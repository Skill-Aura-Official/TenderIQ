import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'react-hot-toast';
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "TenderIQ | AI Tender Discovery & Bid Management",
  description: "Identify government and public sector tenders, verify compliance requirements automatically, and manage bids through a unified pipeline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased h-full text-slate-900`} suppressHydrationWarning>
        <ClerkProvider>
          <Toaster position="top-right" />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}

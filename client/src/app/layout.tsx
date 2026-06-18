import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from '@clerk/nextjs';
import { Toaster } from 'react-hot-toast';
import { PostHogProvider } from '@/providers/posthog-provider';
import { LanguageProvider } from '@/providers/LanguageProvider';
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
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ClerkProvider>
          <PostHogProvider>
            <LanguageProvider>
              {children}
              <Toaster position="top-right" />
            </LanguageProvider>
          </PostHogProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}

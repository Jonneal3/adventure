import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from '@/components/ui/toaster';
import StructuredData from '@/components/seo/StructuredData';
import AppShellClient from './AppShellClient';

const BRAND_NAME = "Adventure";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://adventure.app";



export const viewport = {
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  width: 'device-width',
};

export const metadata: Metadata = {
  alternates: {
    canonical: SITE_URL,
  },
  authors: [{ name: `${BRAND_NAME} Team` }],
  creator: BRAND_NAME,
  description: "Transform your website with AI-powered visualization widgets. Let customers see exactly what they want before they buy. Perfect for fashion, furniture, interior design, and landscaping businesses.",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  icons: {
    icon: [
      { media: "(prefers-color-scheme: light)", type: "image/svg+xml", url: "/icon-light.svg" },
      { media: "(prefers-color-scheme: dark)", type: "image/svg+xml", url: "/icon-dark.svg" },
    ],
    shortcut: ["/icon-light.svg"],
  },
  keywords: [
    "AI visualization widget",
    "virtual try-on",
    "hair salon software",
    "fashion visualization",
    "furniture visualization",
    "interior design tool",
    "customer experience",
    "e-commerce widget",
    "AI-powered business tools",
    "visualization software",
    "before and after tool",
    "customer engagement",
    "website widget",
    "AI business solutions"
  ],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    description: "Transform your website with AI-powered visualization widgets. Let customers see exactly what they want before they buy. Perfect for fashion, furniture, interior design, and landscaping businesses.",
    images: [
      {
        alt: `${BRAND_NAME} - AI Visualization Widgets`,
        height: 630,
        url: "/og-image.svg",
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} - AI Visualization Widgets`,
    type: "website",
    url: SITE_URL,
  },
  publisher: BRAND_NAME,
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: `${BRAND_NAME} - AI Visualization Widgets`,
    template: `%s | ${BRAND_NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    creator: "@adventure",
    description: "Transform your website with AI-powered visualization widgets. Let customers see exactly what they want before they buy. Perfect for fashion, furniture, interior design, and landscaping businesses.",
    images: ["/og-image.svg"],
    title: `${BRAND_NAME} - AI Visualization Widgets`,
  },
  verification: {
    google: "your-google-verification-code",
    yahoo: "your-yahoo-verification-code",
    yandex: "your-yandex-verification-code",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <StructuredData />
      </head>
      <body>
        <AppShellClient>
          {children}
        </AppShellClient>
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}

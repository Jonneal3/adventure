import type { Metadata } from 'next';
import './globals.css';

const BRAND_NAME = "Adventure";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://adventure.app";

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME}`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: "AI-powered visualization widgets that let customers see what they want before they buy.",
  icons: {
    icon: [
      { media: "(prefers-color-scheme: light)", type: "image/svg+xml", url: "/icon-light.svg" },
      { media: "(prefers-color-scheme: dark)", type: "image/svg+xml", url: "/icon-dark.svg" },
    ],
    shortcut: ["/icon-light.svg"],
  },
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: `${BRAND_NAME}`,
    description: "AI-powered visualization widgets that let customers see what they want before they buy.",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: `${BRAND_NAME}` }],
    url: SITE_URL,
    siteName: BRAND_NAME,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

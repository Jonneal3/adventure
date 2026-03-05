import type { Metadata } from "next";

const AUTH_BRAND_NAME = "Adventure";

export const metadata: Metadata = {
  title: {
    default: `Sign in | ${AUTH_BRAND_NAME}`,
    template: `%s | ${AUTH_BRAND_NAME}`,
  },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}

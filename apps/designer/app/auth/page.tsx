import { Suspense } from "react";

import AuthPageClient from "./AuthPageClient";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md px-4 py-10 text-sm text-muted-foreground">Loading…</div>}>
      <AuthPageClient />
    </Suspense>
  );
}

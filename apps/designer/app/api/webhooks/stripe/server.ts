// This file is for Server Components only
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Database } from "@/supabase/types";

export const createClient = () => {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
};

export const createServerComponent = createClient; 
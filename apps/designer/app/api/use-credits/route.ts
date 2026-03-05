import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CreditService } from '@/lib/stripe/credit-reloads/credit-service';

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { credits, operation, accountId } = await request.json() as { 
      credits: number;
      operation: string;
      accountId: string;
    };

    if (!credits || credits <= 0) {
      return NextResponse.json(
        { error: "Invalid credit amount" },
        { status: 400 }
      );
    }

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    const creditService = new CreditService();

    // Deduct credits (this will handle auto-purchase if enabled)
    const result = await creditService.deductCredits(accountId, credits, operation);

    if (!result.success) {
      if (result.autoPurchased) {
        // Auto-purchase was initiated - return special response to client
        return NextResponse.json({ 
          error: 'Auto-purchase initiated',
          autoPurchased: true,
          paymentIntentId: result.paymentIntentId,
          message: 'Credits are being purchased automatically. Please retry in a few seconds.'
        }, { status: 202 }); // 202 Accepted
      } else {
        // Insufficient credits and no auto-purchase
        return NextResponse.json(
          { 
            error: "Insufficient credits",
            currentBalance: result.newBalance,
            requiredCredits: credits,
            canAutoPurchase: false
          },
          { status: 402 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      newBalance: result.newBalance,
      autoPurchased: result.autoPurchased,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error processing credit usage" },
      { status: 500 }
    );
  }
} 
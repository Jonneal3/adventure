"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
// import { createClientComponent } from "@/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Star, ArrowLeft, Send, CheckCircle, Loader2 } from "lucide-react";

function ContactPageContent() {
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan");
  // const supabase = createClientComponent();

  useEffect(() => {
    async function getUser() {
      // const { data: { user } } = await supabase.auth.getUser();
      // setUser(user);
    }
    getUser();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      company: formData.get("company") as string,
      message: formData.get("message") as string,
      plan: plan || "Enterprise",
      userId: user?.id,
    };

    try {
      // You could send this to a webhook, email service, or database
      // await fetch("/api/contact", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(data),
      // });

      setSubmitted(true);
    } catch (error) {} finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
              <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <CardTitle className="text-xl">Thanks — we'll reach out shortly</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              We've received your inquiry and will get back to you within 24 hours.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => router.push("/designer-instances")} className="px-6">
                Go to dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <div className="container mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <div className="flex justify-center">
            <Button
              onClick={() => router.back()}
              variant="outline"
              size="sm"
              className="rounded-full"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          <div className="mt-8">
            <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Star className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-4xl font-semibold tracking-tight">Contact sales</h1>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Tell us what you're building and we'll help you pick the right plan and rollout strategy.
            </p>
          </div>

          {plan ? (
            <div className="mt-5">
              <Badge variant="secondary" className="px-3 py-1 text-xs">
                {plan} plan inquiry
              </Badge>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Send a message</CardTitle>
              <p className="text-sm text-muted-foreground">
                We typically respond within 24 hours.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full name *</Label>
                    <Input
                      id="name"
                      name="name"
                      required
                      defaultValue={user?.user_metadata?.full_name || ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      defaultValue={user?.email || ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    name="company"
                    placeholder="Your company name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    rows={6}
                    placeholder="Tell us about your needs, expected usage, and any specific requirements..."
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send message
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What to expect</CardTitle>
              <p className="text-sm text-muted-foreground">
                A quick process, tailored to your use case.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  title: "Quick response",
                  body: "We'll reply within 24 hours with next steps and a few clarifying questions.",
                },
                {
                  title: "Right-sized plan",
                  body: "We'll recommend a plan based on your expected traffic, usage, and team needs.",
                },
                {
                  title: "Implementation support",
                  body: "We'll help you launch confidently with onboarding and rollout guidance.",
                },
              ].map((item, idx) => (
                <div key={item.title} className="flex items-start gap-3">
                  <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-background/40 text-xs font-semibold text-foreground shadow-sm">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.title}</div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ContactPageContent />
    </Suspense>
  );
} 

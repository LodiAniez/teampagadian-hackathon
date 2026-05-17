import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <h1 className="text-balance text-5xl font-bold tracking-tight text-slate-900 md:text-6xl">
        Get paid for every gig, from anywhere in the world.
      </h1>
      <p className="max-w-2xl text-balance text-lg text-slate-600">
        Raket is the payment account built for Filipino freelancers earning from global clients —
        invoice, get paid in PHP in minutes, with transparent FX and AI-powered invoicing.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/login">Get started</Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/dashboard">View demo</Link>
        </Button>
      </div>
    </main>
  );
}

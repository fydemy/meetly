"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const purchaseId = searchParams.get("purchase") ?? "";
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between max-w-4xl mx-auto h-20 px-4 w-full">
        <Link href="/">
          <Image src="/logo.svg" alt="Meetly" width={90} height={90} />
        </Link>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="size-16 text-green-600" />
          </div>
          <h1 className="text-2xl font-semibold">Payment successful</h1>
          <p className="text-muted-foreground">
            Your payment has been processed. You will receive confirmation and
            access details by email.
          </p>
          {session?.user && purchaseId && (
            <Link
              href={`/dashboard/enrolled/${purchaseId}`}
              className={buttonVariants({ variant: "default" })}
            >
              View enrollment
            </Link>
          )}
          <div className="pt-4">
            <Link href="/" className={buttonVariants({ variant: "secondary" })}>
              Back to home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <SuccessContent />
    </Suspense>
  );
}

"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { authClient } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
import { XCircle } from "lucide-react";

function FailedContent() {
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
            <XCircle className="size-16 text-destructive" />
          </div>
          <h1 className="text-2xl font-semibold">Payment failed or cancelled</h1>
          <p className="text-muted-foreground">
            Your payment was not completed. You can try again or contact support
            if you need help.
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

export default function FailedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <FailedContent />
    </Suspense>
  );
}

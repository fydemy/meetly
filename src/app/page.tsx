"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const { data: me, isFetched: isMeFetched } = trpc.user.getMe.useQuery(
    undefined,
    { enabled: !!session?.user }
  );

  useEffect(() => {
    if (isSessionPending || !session?.user) return;
    if (!isMeFetched) return;
    const target = me?.slug ? `/${me.slug}` : "/dashboard";
    router.replace(target);
  }, [session?.user, isSessionPending, isMeFetched, me?.slug, router]);

  if (session?.user && !isMeFetched) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <header className="flex items-center justify-between max-w-4xl mx-auto h-20 px-4">
        <Link href="/dashboard">
          <Image src="/logo.svg" alt="Meetly" width={90} height={90} />
        </Link>
      </header>
      <div className="max-w-4xl mx-auto px-4 flex flex-col gap-12 items-center justify-center my-16">
        <h1 className="text-3xl md:text-5xl font-bold text-center text-balance tracking-tight">
          Create instant course beautifully and effortlessly
        </h1>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              authClient.signIn.social({
                provider: "google",
                callbackURL: "/dashboard",
              });
            }}
          >
            Get Started
          </Button>
          <Link
            href="https://wa.me/6587470061"
            className={buttonVariants({ variant: "secondary" })}
          >
            Contact
          </Link>
        </div>
        <video src="/demo.mp4" autoPlay muted loop className="rounded-2xl" />
      </div>
    </>
  );
}

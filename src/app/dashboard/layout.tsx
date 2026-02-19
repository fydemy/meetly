"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const { data: session } = authClient.useSession();

  return (
    <>
      <header className="flex items-center justify-between max-w-4xl mx-auto h-20 px-4">
        <Link href="/dashboard">
          <Image src="/logo.svg" alt="Meetly" width={90} height={90} />
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{session?.user?.name}</span>
          <Link
            href="https://wa.me/6587470061"
            target="_blank"
            className={buttonVariants({ variant: "secondary" })}
          >
            Withdraw (min IDR 500K)
          </Link>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => {
              authClient.signOut();
              router.push("/");
            }}
          >
            <LogOut />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-10 my-16 px-4">
        {children}
      </main>
    </>
  );
};

export default Layout;

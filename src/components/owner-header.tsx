"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { LogOut, Settings } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

const WHATSAPP_WITHDRAW_URL = "https://wa.me/6587470061";
const MIN_WITHDRAWAL_IDR = 500_000;
const WITHDRAWAL_FEE_PERCENT = 5;

const formatIdr = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);

export function OwnerHeader({ logoHref }: { logoHref: string }) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const { data: revenueData } = trpc.package.getTotalRevenue.useQuery(
    undefined,
    { enabled: !!session?.user }
  );

  const actualRevenue = revenueData?.totalRevenue ?? 0;
  const withdrawable = Math.floor(actualRevenue * (1 - WITHDRAWAL_FEE_PERCENT / 100));

  return (
    <header className="flex items-center justify-between max-w-4xl mx-auto h-20 px-4">
      <Link href={logoHref}>
        <Image src="/logo.svg" alt="Meetly" width={90} height={90} />
      </Link>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{session?.user?.name}</span>
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              className={buttonVariants({ variant: "secondary" })}
            >
              Withdraw
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Withdraw revenue</DialogTitle>
              <DialogDescription>
                Minimum withdrawal: {formatIdr(MIN_WITHDRAWAL_IDR)}. A {WITHDRAWAL_FEE_PERCENT}% fee applies to withdrawals.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Actual revenue</span>
                <span className="font-medium">{formatIdr(actualRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Withdrawable (after {WITHDRAWAL_FEE_PERCENT}% fee)</span>
                <span className="font-medium">{formatIdr(withdrawable)}</span>
              </div>
            </div>
            <DialogFooter>
              <Button asChild>
                <a
                  href={WHATSAPP_WITHDRAW_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Contact via WhatsApp
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Link
          href="/dashboard/settings"
          className={buttonVariants({ variant: "ghost", size: "icon" })}
          title="Settings"
        >
          <Settings className="size-4" />
        </Link>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            authClient.signOut();
            router.push("/");
          }}
        >
          <LogOut className="size-4" />
        </Button>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { File } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function EnrolledPage() {
  const {
    data: purchases,
    isLoading,
    isError,
  } = trpc.package.getUserPurchases.useQuery();

  const enrolled = purchases?.filter((p) => p.status === "paid") ?? [];

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Enrolled</h1>
        </div>
        <Link
          href="/dashboard"
          className={buttonVariants({ variant: "secondary" })}
        >
          Back to events
        </Link>
      </div>

      {!isLoading && !isError && enrolled.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <File />
            </EmptyMedia>
            <EmptyTitle>No enrollments</EmptyTitle>
            <EmptyDescription>
              You&apos;re not enrolled in any events yet.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              Browse events
            </Link>
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && !isError && enrolled.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {enrolled.map((purchase) => (
            <Link
              key={purchase.id}
              href={`/dashboard/enrolled/${purchase.id}`}
              className="block"
            >
              <Card className="h-full cursor-pointer transition hover:bg-gray-50">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">
                    {purchase.package.event.title}
                  </CardTitle>
                  <CardDescription>{purchase.package.name}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mt-1 text-xs text-gray-500">
                    Paid{" "}
                    {purchase.paidAt
                      ? new Date(purchase.paidAt).toLocaleString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

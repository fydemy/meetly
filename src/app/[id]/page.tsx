/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditorBlock = {
  id?: string;
  type: string;
  data: Record<string, unknown>;
};

export default function PublicEventPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const { data, isLoading } = trpc.event.getById.useQuery({
    id: eventId,
  });

  const event = data as any;
  const packageId = (event?.package?.id ?? undefined) as string | undefined;

  const { data: packageData, isLoading: isPackageLoading } =
    trpc.package.getById.useQuery(packageId ? { id: packageId } : skipToken);

  const { data: session } = authClient.useSession();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const enrollMutation = trpc.package.enroll.useMutation({
    onSuccess: (data) => {
      window.location.href = data.invoiceUrl ?? "";
    },
    onError: (error) => {
      alert(error.message);
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading event...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Event not found</p>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mt-4 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const blocks = (event.content?.blocks ?? []) as EditorBlock[];
  const hasPackageBlock = blocks.some((b) => b.type === "package");

  const pkg = (packageData ?? event.package) as
    | {
        id: string;
        name: string;
        price: number;
        currency: string;
        googleMeetings?: {
          meetingId: string;
          startDateTime: string;
          timezone: string;
        }[];
        googleDriveFolderId?: string | null;
      }
    | undefined;

  const formatPrice = (price: number, currency: string) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
    }).format(price);

  const formatDateTime = (dateTime: string, timezone: string) =>
    new Date(dateTime).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    });

  const handleEnroll = () => {
    if (!pkg) return;
    if (session?.user) {
      enrollMutation.mutate({ packageId: pkg.id });
    } else {
      if (!guestName.trim() || !guestEmail.trim()) {
        alert("Please enter your name and email to enroll.");
        return;
      }
      enrollMutation.mutate({
        packageId: pkg.id,
        name: guestName.trim(),
        email: guestEmail.trim(),
      });
    }
  };

  const renderPackageCard = (key: string | number) =>
    pkg ? (
      <section
        key={key}
        className="border p-4 rounded-lg not-prose space-y-2 my-4"
      >
        <div>
          <h2 className="font-medium">{pkg.name}</h2>
          <p className="font-bold">{formatPrice(pkg.price, pkg.currency)}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isPackageLoading &&
            pkg.googleMeetings &&
            pkg.googleMeetings.length > 0 && (
              <>
                {pkg.googleMeetings.map((meeting) => (
                  <Badge key={meeting.meetingId} variant="secondary">
                    <Image
                      src="/icons/meet.svg"
                      alt="Google Meet"
                      width={20}
                      height={20}
                    />
                    {formatDateTime(meeting.startDateTime, meeting.timezone)}
                  </Badge>
                ))}
              </>
            )}

          {!isPackageLoading && pkg.googleDriveFolderId && (
            <Badge variant="secondary">
              <Image
                src="/icons/drive.svg"
                alt="Drive"
                width={16}
                height={16}
              />
              Drive
            </Badge>
          )}
        </div>

        {!session?.user && (
          <div className="mt-4 space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Enroll with your details</p>
            <Input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name"
            />
            <Input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Your email"
            />
          </div>
        )}
        <Button
          type="button"
          onClick={handleEnroll}
          disabled={enrollMutation.isPending}
          size="sm"
          className="mt-2 md:w-auto w-full"
        >
          {enrollMutation.isPending
            ? "Processing..."
            : session?.user
              ? "Purchase"
              : "Enroll"}
        </Button>
      </section>
    ) : null;

  const renderBlock = (block: EditorBlock, index: number) => {
    if (block.type === "package") {
      return renderPackageCard(block.id ?? index);
    }
    const key = block.id ?? index;

    if (block.type === "header") {
      const level =
        typeof (block.data.level as number | undefined) === "number"
          ? (block.data.level as number)
          : 2;
      const text = String(block.data.text ?? "");

      const HeadingTag =
        `h${Math.min(Math.max(level, 1), 4)}` as keyof HTMLElementTagNameMap;

      return (
        <HeadingTag
          key={key}
          className="mt-6 text-balance font-bold first:mt-0"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    if (block.type === "paragraph") {
      const text = String(block.data.text ?? "");
      return (
        <p
          key={key}
          className="mt-4"
          dangerouslySetInnerHTML={{ __html: text }}
        />
      );
    }

    if (block.type === "image") {
      const file = block.data.file as { url?: string } | undefined;
      const url = file?.url;
      if (!url) return null;

      const caption = String(block.data.caption ?? "");

      return (
        <figure key={key} className="my-6">
          <Image
            src={url}
            alt={caption || event.title}
            width={500}
            height={500}
            unoptimized
            className="w-full rounded-lg border object-cover"
          />
          {caption && (
            <figcaption className="mt-2 text-sm text-muted-foreground">
              {caption}
            </figcaption>
          )}
        </figure>
      );
    }

    return null;
  };

  const creator = event?.user as
    | { name: string; image: string | null }
    | undefined;

  return (
    <>
      <header className="mb-8">
        {creator && (
          <div className="mt-3 flex items-center gap-2">
            {creator.image && (
              <Image
                src={creator.image}
                alt={creator.name}
                width={32}
                height={32}
                unoptimized
                className="size-4 rounded-full object-cover"
              />
            )}

            <span className="font-medium text-sm">{creator.name}</span>
          </div>
        )}
      </header>

      <section className="prose max-w-none prose-sm">
        {blocks.map((block, index) => renderBlock(block, index))}
      </section>

      {pkg && !hasPackageBlock && renderPackageCard("package-fallback")}
    </>
  );
}

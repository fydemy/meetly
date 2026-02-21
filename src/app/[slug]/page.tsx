"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { buttonVariants } from "@/components/ui/button";
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
import { OwnerHeader } from "@/components/owner-header";
import { OwnerEventList } from "@/components/owner-event-list";

type ProfileEvent = {
  id: string;
  title: string;
  imageUrl?: string | null;
  createdAt: Date | string;
  package?: object | null;
};

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: session } = authClient.useSession();
  const { data: profile, isLoading, isError } = trpc.user.getBySlug.useQuery(
    { slug },
    { retry: false }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Profile not found</p>
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

  const isOwner = !!(session?.user?.id && profile.id === session.user.id);

  if (isOwner) {
    return (
      <div className="min-h-screen">
        <OwnerHeader logoHref={`/${slug}`} />
        <main className="mx-auto max-w-4xl space-y-10 my-16 px-4">
          <OwnerEventList />
        </main>
      </div>
    );
  }

  const events = (profile.events ?? []) as ProfileEvent[];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <header className="mb-10 flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left">
        {profile.image && (
          <Image
            src={profile.image}
            alt={profile.name}
            width={80}
            height={80}
            unoptimized
            className="rounded-full object-cover"
          />
        )}
        <div>
          <h1 className="text-2xl font-semibold">{profile.name}</h1>
          <p className="text-muted-foreground">
            Events by {profile.name}
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "secondary" })}>
          Browse all events
        </Link>
      </header>

      {events.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <File />
            </EmptyMedia>
            <EmptyTitle>No events yet</EmptyTitle>
            <EmptyDescription>
              {profile.name} hasn&apos;t published any events.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Link href="/" className={buttonVariants({ variant: "default" })}>
              Browse events
            </Link>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} href={`/e/${event.id}`}>
              <Card className="h-full transition-colors hover:bg-muted/50">
                {event.imageUrl && (
                  <Image
                    src={event.imageUrl}
                    alt={event.title}
                    width={300}
                    height={160}
                    loading="lazy"
                    unoptimized
                    className="w-full rounded-t-xl object-cover h-40"
                  />
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <CardDescription>
                    {new Date(event.createdAt).toLocaleString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                {event.package && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">
                      Package available
                    </p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

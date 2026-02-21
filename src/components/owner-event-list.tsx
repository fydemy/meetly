"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { ExternalLink, File, Plus, Trash } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

const MAX_EVENTS_PER_USER = 5;

type EventItem = {
  id: string;
  title: string;
  imageUrl?: string | null;
  createdAt: Date | string;
  package: {
    id: string;
    googleMeetings?: unknown;
    googleDriveFolderId?: string | null;
  } | null;
};

export function OwnerEventList() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: events, isLoading, isError } = trpc.event.getMine.useQuery();

  const deleteEvent = trpc.event.delete.useMutation({
    onSuccess: () => {
      void utils.event.getMine.invalidate();
    },
  });

  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this event?")) return;
    deleteEvent.mutate({ id });
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Meet</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/enrolled"
            className={buttonVariants({ variant: "secondary" })}
          >
            Enrolled
          </Link>
          {events && events.length >= MAX_EVENTS_PER_USER ? (
            <span
              className={buttonVariants({
                variant: "default",
                className: "pointer-events-none opacity-60",
              })}
              title={`Maximum ${MAX_EVENTS_PER_USER} events. Delete one to create a new one.`}
            >
              <Plus className="size-4" /> New
            </span>
          ) : (
            <Link
              href="/dashboard/new"
              className={buttonVariants({ variant: "default" })}
            >
              <Plus className="size-4" /> New
            </Link>
          )}
          {events && events.length >= MAX_EVENTS_PER_USER && (
            <span className="text-sm text-muted-foreground">
              Max {MAX_EVENTS_PER_USER} events. Delete one to create a new one.
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {!isLoading && !isError && (!events || events.length === 0) && (
          <Empty className="col-span-3">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <File />
              </EmptyMedia>
              <EmptyTitle>No events</EmptyTitle>
              <EmptyDescription>
                You don&apos;t have any events yet.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/dashboard/new"
                className={buttonVariants({ variant: "default" })}
              >
                <Plus className="size-4" /> New
              </Link>
            </EmptyContent>
          </Empty>
        )}

        {!isLoading && !isError && events && events.length > 0 && (
          <>
            {(events as unknown as EventItem[]).map((event) => {
              const pkg = event.package;
              const meetingsRaw = pkg?.googleMeetings;
              const meetings = Array.isArray(meetingsRaw)
                ? (meetingsRaw as Array<Record<string, unknown>>)
                : [];
              const driveConnected = !!pkg?.googleDriveFolderId;

              return (
                <Card
                  key={event.id}
                  onClick={() => router.push(`/dashboard/${event.id}`)}
                  className={`cursor-pointer ${event.imageUrl ? "pt-0" : ""}`}
                >
                  {event.imageUrl && (
                    <Image
                      src={event.imageUrl}
                      alt={event.title}
                      width={200}
                      height={200}
                      loading="lazy"
                      unoptimized
                      className="w-full h-40 object-cover rounded-t-xl"
                    />
                  )}
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold">
                      {event.title}
                    </CardTitle>
                    <CardDescription>
                      {new Date(event.createdAt).toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {pkg && (
                      <div className="space-y-2 text-xs text-gray-600">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary">
                            <Image
                              src="/icons/meet.svg"
                              alt="Google Meet"
                              width={20}
                              height={20}
                            />
                            {meetings.length}
                          </Badge>
                          {driveConnected && (
                            <Badge variant="secondary">
                              <Image
                                src="/icons/drive.svg"
                                alt="Google Drive"
                                width={16}
                                height={16}
                              />
                              1
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/e/${event.id}`, "_blank");
                      }}
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(event.id);
                      }}
                      disabled={deleteEvent.isPending}
                    >
                      <Trash className="size-4" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

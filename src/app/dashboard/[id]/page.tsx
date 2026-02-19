/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useCallback, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";

const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price);

const Editor = dynamic(() => import("@/components/editor"), { ssr: false });

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, "");
      resolve(base64);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

type EditorOutput = {
  time?: number;
  version?: string;
  blocks?: unknown[];
};

const EditEventPage = () => {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [content, setContent] = useState<EditorOutput | null>(null);
  const blobFilesRef = useRef<Map<string, File>>(new Map());

  const utils = trpc.useUtils();

  const {
    data: event,
    isLoading,
    isError,
  } = trpc.event.getById.useQuery(
    {
      id: eventId,
    },
    {
      // Enable real-time sync: refetch on window focus and reconnect
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      // Poll every 5 seconds for real-time updates
      refetchInterval: 5000,
    },
  );

  const { data: enrollmentsData } =
    trpc.package.getEnrollmentsForEvent.useQuery(
      { eventId },
      { enabled: !!event?.package?.id },
    );

  const eventQueryUtils = utils.event.getById as any;

  const updateEvent = trpc.event.update.useMutation({
    // Optimistic update: update cache immediately before server responds
    onMutate: async (variables: any) => {
      // Cancel outgoing queries
      await eventQueryUtils.cancel({ id: eventId });

      // Snapshot previous value
      const previousEvent = eventQueryUtils.getData({ id: eventId });

      // Optimistically update cache
      if (previousEvent) {
        eventQueryUtils.setData(
          { id: eventId },
          {
            ...previousEvent,
            content: variables.content as any,
            title: variables.content.blocks?.find(
              (b: { type?: string }) => b.type === "header",
            )?.data?.text
              ? String(
                  variables.content.blocks.find(
                    (b: { type?: string }) => b.type === "header",
                  )?.data?.text,
                ).trim()
              : previousEvent.title,
          },
        );
      }

      return { previousEvent };
    },
    onError: (_err: any, _variables: any, context: any) => {
      // Rollback on error
      if (context?.previousEvent) {
        eventQueryUtils.setData({ id: eventId }, context.previousEvent);
      }
    },
    onSuccess: (data: any) => {
      // Update cache with server response
      eventQueryUtils.setData({ id: eventId }, data);

      // Clear local content state since changes are now saved
      setContent(null);

      // Invalidate to ensure consistency
      void eventQueryUtils.invalidate({ id: eventId });

      router.push("/dashboard");
    },
  } as any);

  const onImageFile = useCallback((url: string, file: File) => {
    blobFilesRef.current.set(url, file);
  }, []);

  const handleSave = async () => {
    if (!event) return;

    const currentContent: EditorOutput =
      (content as EditorOutput | null) ??
      ((event as any).content as EditorOutput);
    const blocks = currentContent?.blocks ?? [];

    const blobUrls = blocks
      .filter(
        (b): b is { type: string; data?: { file?: { url?: string } } } =>
          typeof b === "object" &&
          b !== null &&
          (b as { type?: string }).type === "image" &&
          typeof (b as { data?: { file?: { url?: string } } }).data?.file
            ?.url === "string" &&
          (
            b as { data?: { file?: { url?: string } } }
          ).data!.file!.url!.startsWith("blob:"),
      )
      .map((b) => b.data!.file!.url!);

    const seen = new Set<string>();
    const files: { blobUrl: string; base64: string }[] = [];
    for (const blobUrl of blobUrls) {
      if (seen.has(blobUrl)) continue;
      seen.add(blobUrl);
      const file = blobFilesRef.current.get(blobUrl);
      if (!file) continue;
      const base64 = await fileToBase64(file);
      files.push({ blobUrl, base64 });
    }

    type EditorBlock = {
      id?: string;
      type: string;
      data: Record<string, unknown>;
    };

    await updateEvent.mutateAsync({
      id: eventId,
      content: {
        blocks: (currentContent?.blocks ?? []) as EditorBlock[],
        time: currentContent?.time,
        version: currentContent?.version,
      },
      files,
    });
    blobFilesRef.current.clear();
  };

  if (isLoading || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-700">
          {isLoading ? "Loading event…" : "Event not found"}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-red-600">
          Failed to load event. Please refresh the page.
        </p>
      </div>
    );
  }

  const editorData: EditorOutput | null =
    (content as EditorOutput | null) ??
    ((event as any).content as EditorOutput | null);

  return (
    <div className="max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">
        Edit event: {event.title}
      </h1>

      <Tabs defaultValue="content" className="mt-4">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          {event.package && <TabsTrigger value="summary">Summary</TabsTrigger>}
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-4">
          <div className="prose">
            <Editor
              data={editorData ?? undefined}
              onChange={setContent}
              onImageFile={onImageFile}
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={updateEvent.isPending}
            >
              {updateEvent.isPending ? "Saving…" : "Save changes"}
            </Button>
            <Button
              type="button"
              onClick={() => router.push("/dashboard")}
              variant="outline"
            >
              Cancel
            </Button>
            {updateEvent.isError && (
              <p className="mt-2 text-sm text-red-600">
                {updateEvent.error.message}
              </p>
            )}
          </div>
        </TabsContent>

        {event.package && (
          <TabsContent value="summary" className="mt-4">
            <section>
              {/* Revenue summary */}
              <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <h3 className="text-sm font-semibold">Revenue</h3>
                {enrollmentsData ? (
                  <>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {formatPrice(
                        enrollmentsData.revenue,
                        enrollmentsData.currency,
                      )}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-gray-500">Loading…</p>
                )}
              </div>

              {/* Enrolled users list */}
              <div className="rounded-lg border bg-white">
                <h3 className="border-b px-4 py-3 text-sm font-semibold">
                  Enrolled users
                </h3>
                {enrollmentsData ? (
                  enrollmentsData.enrollments.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-gray-500">
                      No enrollments yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="px-4 py-2 font-medium">Name</th>
                            <th className="px-4 py-2 font-medium">Email</th>
                            <th className="px-4 py-2 font-medium">Status</th>
                            <th className="px-4 py-2 font-medium">Paid at</th>
                          </tr>
                        </thead>
                        <tbody>
                          {enrollmentsData.enrollments.map((e) => (
                            <tr
                              key={e.id}
                              className="border-b border-gray-50 last:border-0"
                            >
                              <td className="px-4 py-2">
                                {e.buyer?.name ?? "—"}
                              </td>
                              <td className="px-4 py-2">
                                {e.buyer?.email ?? "—"}
                              </td>
                              <td className="px-4 py-2">
                                <span
                                  className={
                                    e.status === "paid"
                                      ? "rounded bg-green-100 px-2 py-0.5 text-green-800"
                                      : "rounded bg-amber-100 px-2 py-0.5 text-amber-800"
                                  }
                                >
                                  {e.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-600">
                                {e.paidAt
                                  ? new Date(e.paidAt).toLocaleString("en-US", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                ) : (
                  <p className="px-4 py-6 text-sm">Loading…</p>
                )}
              </div>
            </section>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default EditEventPage;

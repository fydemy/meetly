"use client";

import { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_EVENTS_PER_USER = 5;
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

const Page = () => {
  const router = useRouter();
  const { data: events } = trpc.event.getMine.useQuery();
  const atEventLimit = (events?.length ?? 0) >= MAX_EVENTS_PER_USER;
  const { data: orgMemberships } = trpc.organization.getMyApproved.useQuery();

  const [content, setContent] = useState<{
    blocks?: unknown[];
    time?: number;
    version?: string;
  }>({ blocks: [] });
  const blobFilesRef = useRef<Map<string, File>>(new Map());
  const [organizationId, setOrganizationId] = useState<string | "personal">(
    "personal",
  );

  const createEvent = trpc.event.create.useMutation({
    onSuccess: () => {
      router.push("/dashboard");
    },
  });

  const onImageFile = useCallback((url: string, file: File) => {
    blobFilesRef.current.set(url, file);
  }, []);

  const handleSave = async () => {
    const blocks = content?.blocks ?? [];
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
    await createEvent.mutateAsync({
      content: {
        blocks: (content?.blocks ?? []) as EditorBlock[],
        time: content?.time,
        version: content?.version,
      },
      files,
      organizationId:
        organizationId && organizationId !== "personal"
          ? organizationId
          : undefined,
    });
    blobFilesRef.current.clear();
  };

  if (atEventLimit) {
    return (
      <div className="prose max-w-md">
        <p className="text-muted-foreground">
          You can create at most {MAX_EVENTS_PER_USER} events. Delete an event
          from your dashboard to create a new one.
        </p>
        <Link href="/dashboard" className={buttonVariants({ variant: "default" })}>
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="prose">
      {orgMemberships && orgMemberships.length > 0 && (
        <div className="mb-4 flex flex-col gap-2 not-prose">
          <label className="text-sm font-medium">Organizer</label>
          <Select
            value={organizationId}
            onValueChange={(v) =>
              setOrganizationId((v as string) || "personal")
            }
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              {orgMemberships.map((m) => (
                <SelectItem key={m.organization.id} value={m.organization.id}>
                  {m.organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <Editor data={content} onChange={setContent} onImageFile={onImageFile} />
      <div className="mt-4">
        <Button
          onClick={() => void handleSave()}
          disabled={createEvent.isPending}
        >
          {createEvent.isPending ? "Saving…" : "Save event"}
        </Button>
        {createEvent.isError && <p>{createEvent.error.message}</p>}
      </div>
    </div>
  );
};

export default Page;

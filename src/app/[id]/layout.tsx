import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      title: true,
      imageUrl: true,
      content: true,
      user: { select: { name: true } },
    },
  });

  if (!event) {
    return {
      title: "Event not found",
    };
  }

  const title = event.title || "Event";
  const creatorName = event.user?.name;

  let description: string;
  const blocks = (
    event.content as {
      blocks?: Array<{ type: string; data?: { text?: string } }>;
    }
  )?.blocks;
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, "").trim();
  if (blocks?.length) {
    const firstWithText = blocks.find(
      (b) =>
        (b.type === "paragraph" || b.type === "header") &&
        typeof b.data?.text === "string" &&
        b.data.text.trim().length > 0,
    );
    const raw =
      firstWithText && typeof firstWithText.data?.text === "string"
        ? stripHtml(firstWithText.data.text).slice(0, 160)
        : "";
    description =
      raw ||
      (creatorName
        ? `${title} by ${creatorName}. Join this event.`
        : `${title}. Join this event.`);
  } else {
    description = creatorName
      ? `${title} by ${creatorName}. Join this event.`
      : `${title}. Join this event.`;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://example.com";
  const url = `${baseUrl}/${id}`;
  const imageUrl = event.imageUrl
    ? event.imageUrl.startsWith("http")
      ? event.imageUrl
      : `${baseUrl}${event.imageUrl}`
    : undefined;

  return {
    title: `${title} | Event`,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Event",
      ...(imageUrl && {
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      }),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(imageUrl && { images: [imageUrl] }),
    },
    alternates: { canonical: url },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl space-y-10 my-16 px-4">
      <Link href="/" className="text-sm flex gap-1">
        Created with{" "}
        <Image src="/fav.svg" alt="Meetly" width={16} height={16} />{" "}
        <span className="font-semibold">Meetly</span>
      </Link>
      {children}
    </div>
  );
}

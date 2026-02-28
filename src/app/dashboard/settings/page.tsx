"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Settings } from "lucide-react";

export default function SettingsPage() {
  const [slugInput, setSlugInput] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgLogoUrl, setOrgLogoUrl] = useState("");
  const [orgMessage, setOrgMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const { data: me, isLoading } = trpc.user.getMe.useQuery();
  const { data: ownedOrgs } = trpc.organization.getMyOwned.useQuery();
  const updateProfile = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      setMessage({ type: "success", text: "Profile slug saved." });
      void utils.user.getMe.invalidate();
    },
    onError: (err) => {
      setMessage({ type: "error", text: err.message });
    },
  });
  const utils = trpc.useUtils();
  const createOrg = trpc.organization.create.useMutation({
    onSuccess: () => {
      setOrgMessage({ type: "success", text: "Organization created." });
      setOrgName("");
      setOrgLogoUrl("");
      void utils.organization.getMyOwned.invalidate();
    },
    onError: (err) => {
      setOrgMessage({ type: "error", text: err.message });
    },
  });
  const inviteMember = trpc.organization.inviteMember.useMutation({
    onSuccess: () => {
      setOrgMessage({ type: "success", text: "Member invited." });
      void utils.organization.getMyOwned.invalidate();
    },
    onError: (err) => {
      setOrgMessage({ type: "error", text: err.message });
    },
  });

  useEffect(() => {
    if (me?.slug != null) setSlugInput(me.slug);
    else setSlugInput("");
  }, [me?.slug]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    const value = slugInput
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
    const normalized = value === "" ? "" : value.replace(/^-+|-+$/g, "");
    updateProfile.mutate({ slug: normalized === "" ? "" : normalized });
  };

  const profileUrl =
    typeof window !== "undefined" && me?.slug
      ? `${window.location.origin}/${me.slug}`
      : null;

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings className="size-6" />
            Settings
          </h1>
        </div>
        <Link href="/dashboard" className={buttonVariants({ variant: "secondary" })}>
          Back to events
        </Link>
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Profile slug</CardTitle>
          <CardDescription>
            Set a custom URL slug for your public profile. Your profile will list all events you
            created. Use only lowercase letters, numbers, and hyphens (e.g. john-doe).
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="slug" className="text-sm font-medium">
                Custom slug
              </label>
              <Input
                id="slug"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="my-profile"
                disabled={isLoading}
                className="font-mono"
              />
              {profileUrl && (
                <p className="text-sm text-muted-foreground">
                  Profile URL:{" "}
                  <a
                    href={profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline"
                  >
                    {profileUrl}
                  </a>
                </p>
              )}
            </div>
            {message && (
              <p
                className={
                  message.type === "error"
                    ? "text-sm text-destructive"
                    : "text-sm text-green-600"
                }
              >
                {message.text}
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={updateProfile.isPending || isLoading}>
              {updateProfile.isPending ? "Saving..." : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card className="max-w-xl mt-8">
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>
            Optionally create organizations to group events and invite team members by email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-sm font-medium">
              Organization name
            </label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Studio"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="org-logo" className="text-sm font-medium">
              Logo URL (optional)
            </label>
            <Input
              id="org-logo"
              value={orgLogoUrl}
              onChange={(e) => setOrgLogoUrl(e.target.value)}
              placeholder="https://…/logo.png"
            />
          </div>
          {orgMessage && (
            <p
              className={
                orgMessage.type === "error"
                  ? "text-sm text-destructive"
                  : "text-sm text-green-600"
              }
            >
              {orgMessage.text}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            type="button"
            disabled={createOrg.isPending || !orgName.trim()}
            onClick={() => {
              setOrgMessage(null);
              createOrg.mutate({
                name: orgName.trim(),
                logoUrl: orgLogoUrl.trim() || undefined,
              });
            }}
          >
            {createOrg.isPending ? "Creating..." : "Create organization"}
          </Button>

          {ownedOrgs && ownedOrgs.length > 0 && (
            <div className="w-full space-y-4">
              <p className="text-sm font-medium">Your organizations</p>
              <div className="space-y-3">
                {ownedOrgs.map((org) => (
                  <div key={org.id} className="rounded-md border p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{org.name}</span>
                      {org.logoUrl && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {org.logoUrl}
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        Members ({org.members.length})
                      </p>
                      <ul className="text-xs space-y-0.5">
                        {org.members.map((m) => (
                          <li key={m.id}>
                            {m.email} — {m.role} ({m.status})
                          </li>
                        ))}
                      </ul>
                    </div>
                    <form
                      className="flex flex-wrap gap-2 items-center mt-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const formData = new FormData(form);
                        const email = String(formData.get("email") || "").trim();
                        if (!email) return;
                        setOrgMessage(null);
                        inviteMember.mutate({
                          organizationId: org.id,
                          email,
                        });
                        form.reset();
                      }}
                    >
                      <Input
                        type="email"
                        name="email"
                        placeholder="Invite member by email"
                        className="max-w-xs"
                      />
                      <Button type="submit" variant="secondary" size="sm">
                        Invite
                      </Button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardFooter>
      </Card>
    </>
  );
}

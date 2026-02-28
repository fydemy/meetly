"use client";

import { trpc } from "@/lib/trpc/client";
import { authClient } from "@/lib/auth-client";
import { OwnerHeader } from "@/components/owner-header";
import { Button } from "@/components/ui/button";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { data: session } = authClient.useSession();
  const { data: me } = trpc.user.getMe.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const utils = trpc.useUtils();
  const { data: pendingInvites } = trpc.organization.getMyPendingInvites.useQuery(
    undefined,
    { enabled: !!session?.user },
  );
  const respondToInvite = trpc.organization.respondToInvite.useMutation({
    onSuccess: () => {
      void utils.organization.getMyPendingInvites.invalidate();
      void utils.organization.getMyApproved.invalidate();
    },
  });
  const logoHref = me?.slug ? `/${me.slug}` : "/dashboard";

  return (
    <>
      {pendingInvites && pendingInvites.length > 0 && (
        <div className="w-full bg-amber-50 border-b border-amber-200">
          <div className="mx-auto max-w-4xl px-4 py-2 text-sm flex flex-col gap-2">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <span>
                  You have been invited to join{" "}
                  <span className="font-medium">
                    {invite.organization.name}
                  </span>{" "}
                  as {invite.role}.
                </span>
                <div className="flex gap-2">
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={respondToInvite.isPending}
                    onClick={() =>
                      respondToInvite.mutate({
                        membershipId: invite.id,
                        approve: true,
                      })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={respondToInvite.isPending}
                    onClick={() =>
                      respondToInvite.mutate({
                        membershipId: invite.id,
                        approve: false,
                      })
                    }
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <OwnerHeader logoHref={logoHref} />
      <main className="mx-auto max-w-4xl space-y-10 my-16 px-4">
        {children}
      </main>
    </>
  );
};

export default Layout;

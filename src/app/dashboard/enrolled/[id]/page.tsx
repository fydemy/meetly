"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(price);

const formatDateTime = (dateTime: string, timezone: string) =>
  new Date(dateTime).toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
    timeZoneName: "short",
  });

export default function EnrolledDetailPage() {
  const params = useParams();
  const router = useRouter();
  const purchaseId = params.id as string;

  const {
    data: purchase,
    isLoading,
    isError,
  } = trpc.package.getPurchaseById.useQuery(
    { id: purchaseId },
    { retry: false },
  );

  if (isLoading) {
    return (
      <div className="max-w-4xl px-4 py-8">
        <p className="text-sm text-gray-700">Loading…</p>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div className="max-w-4xl px-4 py-8">
        <p className="text-sm text-red-600">
          Purchase not found or you don&apos;t have access.
        </p>
        <button
          type="button"
          onClick={() => router.push("/dashboard/enrolled")}
          className="mt-4 text-sm text-blue-600 hover:underline"
        >
          Back to enrollments
        </button>
      </div>
    );
  }

  const pkg = purchase.package;
  const event = pkg.event;
  const meetings = pkg.googleMeetings ?? [];
  const driveFolderId = pkg.googleDriveFolderId;
  const driveUrl = driveFolderId
    ? `https://drive.google.com/drive/folders/${driveFolderId}`
    : null;

  return (
    <div className="max-w-4xl px-4 py-8">
      <Link
        href="/dashboard/enrolled"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to enrollments
      </Link>

      <header className="mt-4 border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
        <p className="mt-1 text-lg text-gray-700">{pkg.name}</p>
      </header>

      {/* Payment details */}
      <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-900">Payment details</h2>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-600">Status</dt>
            <dd>
              <span
                className={
                  purchase.status === "paid"
                    ? "rounded bg-green-100 px-2 py-0.5 text-green-800"
                    : "rounded bg-amber-100 px-2 py-0.5 text-amber-800"
                }
              >
                {purchase.status}
              </span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-600">Amount</dt>
            <dd className="font-medium">
              {formatPrice(pkg.price, pkg.currency)}
            </dd>
          </div>
          {purchase.paidAt && (
            <div className="flex justify-between">
              <dt className="text-gray-600">Paid at</dt>
              <dd>
                {new Date(purchase.paidAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          )}
          {purchase.createdAt && (
            <div className="flex justify-between">
              <dt className="text-gray-600">Purchased</dt>
              <dd>
                {new Date(purchase.createdAt).toLocaleString("en-US", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Google Meet sessions */}
      {meetings.length > 0 && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Google Meet sessions
          </h2>
          <ul className="mt-3 space-y-3">
            {meetings.map((meeting, i) => (
              <li
                key={meeting.meetingId}
                className="flex flex-col gap-1 rounded border border-gray-100 bg-gray-50 p-3"
              >
                <span className="text-xs text-gray-500">
                  Session {i + 1}
                </span>
                <span className="text-sm text-gray-700">
                  {formatDateTime(meeting.startDateTime, meeting.timezone)}
                </span>
                {meeting.hangoutLink ? (
                  <a
                    href={meeting.hangoutLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                  >
                    Join Meet →
                  </a>
                ) : (
                  <span className="text-sm text-gray-500">
                    Link not available
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Google Drive access */}
      {driveUrl && (
        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Google Drive access
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Open the shared folder to access materials for this event.
          </p>
          <a
            href={driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            Open folder in Drive →
          </a>
        </section>
      )}

      {meetings.length === 0 && !driveUrl && (
        <p className="mt-6 text-sm text-gray-500">
          No Meet sessions or Drive folder for this package.
        </p>
      )}

      <div className="mt-8">
        <Link
          href={`/${event.id}`}
          className="text-sm text-blue-600 hover:underline"
        >
          View event page →
        </Link>
      </div>
    </div>
  );
}

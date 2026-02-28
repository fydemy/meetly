/* eslint-disable @typescript-eslint/no-explicit-any */
import { createRoot, Root } from "react-dom/client";
import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import TRPCLayout from "@/components/provider/trpc";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Package, Plus, X } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import Image from "next/image";

interface MeetingSession {
  startDate: Date | null;
  timezone: string;
  speakerEmails?: string[];
}

const MAX_MEETINGS_PER_EVENT = 3;
const MAX_SPEAKER_EMAILS = 3;

// Helper function to parse emails from space-separated input (max 3)
const parseEmails = (input: string): string[] => {
  const emails = input
    .trim()
    .split(/\s+/)
    .filter((email) => email.length > 0)
    .slice(0, MAX_SPEAKER_EMAILS);
  return emails;
};

// Helper function to validate email format
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// Format date as "YYYY-MM-DDTHH:mm:00" (local wall clock) so server can interpret in meeting timezone
const formatLocalDateTime = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}:00`;
};

interface PackageData {
  name: string;
  price: number;
  includeMeet: boolean;
  includeDrive: boolean;
  meetings: MeetingSession[];
  driveFolder: { path: string; speakerEmails?: string[] };
}

interface PackageFormProps {
  initialData: PackageData;
  onSave: (data: PackageData) => void;
}

const PackageForm: React.FC<PackageFormProps> = ({ initialData, onSave }) => {
  const [name, setName] = useState(initialData.name || "");
  const [price, setPrice] = useState<number>(initialData.price || 0);

  const [includeMeet, setIncludeMeet] = useState(
    initialData.includeMeet ?? false,
  );
  const [includeDrive, setIncludeDrive] = useState(
    initialData.includeDrive ?? false,
  );

  const { data: scopes } = trpc.package.getGoogleScopes.useQuery(undefined, {
    // Refetch when window regains focus (e.g. after returning from OAuth)
    refetchOnWindowFocus: true,
  });
  const hasCalendarScope = scopes?.hasCalendarScope ?? false;
  const hasDriveScope = scopes?.hasDriveScope ?? false;

  const initialMeetings = Array.isArray(initialData.meetings)
    ? initialData.meetings.slice(0, MAX_MEETINGS_PER_EVENT).map((m) => ({
        startDate: m.startDate,
        timezone: m.timezone,
        speakerEmails: m.speakerEmails || [],
      }))
    : [{ startDate: null, timezone: "Asia/Jakarta", speakerEmails: [] }];

  const [meetings, setMeetings] = useState<MeetingSession[]>(initialMeetings);

  // Track speaker email inputs for each meeting
  const [meetingSpeakerEmailInputs, setMeetingSpeakerEmailInputs] = useState<
    string[]
  >(initialMeetings.map((m) => (m.speakerEmails || []).join(" ") || ""));

  const [driveFolderPath, setDriveFolderPath] = useState(
    initialData.driveFolder?.path || "",
  );

  const [driveFolderSpeakerEmailsInput, setDriveFolderSpeakerEmailsInput] =
    useState(initialData.driveFolder?.speakerEmails?.join(" ") || "");

  const timezones = ["Asia/Jakarta", "Asia/Singapore"];

  const addMeeting = () => {
    if (meetings.length >= MAX_MEETINGS_PER_EVENT) return;
    setMeetings([
      ...meetings,
      { startDate: null, timezone: "Asia/Jakarta", speakerEmails: [] },
    ]);
    setMeetingSpeakerEmailInputs([...meetingSpeakerEmailInputs, ""]);
  };

  const removeMeeting = (index: number) => {
    setMeetings(meetings.filter((_, i) => i !== index));
    setMeetingSpeakerEmailInputs(
      meetingSpeakerEmailInputs.filter((_, i) => i !== index),
    );
  };

  const updateMeeting = (
    index: number,
    field: keyof MeetingSession,
    value: any,
  ) => {
    const updated = [...meetings];
    updated[index] = { ...updated[index], [field]: value };
    setMeetings(updated);
  };

  const updateMeetingSpeakerEmails = (index: number, input: string) => {
    const updatedInputs = [...meetingSpeakerEmailInputs];
    updatedInputs[index] = input;
    setMeetingSpeakerEmailInputs(updatedInputs);

    // Parse and update the meeting's speakerEmails
    const emails = parseEmails(input).filter(isValidEmail);
    const updated = [...meetings];
    updated[index] = {
      ...updated[index],
      speakerEmails: emails.length > 0 ? emails : undefined,
    };
    setMeetings(updated);
  };

  const removeMeetingSpeakerEmail = (
    meetingIndex: number,
    emailIndex: number,
  ) => {
    const updated = [...meetings];
    const emails = [...(updated[meetingIndex].speakerEmails || [])];
    emails.splice(emailIndex, 1);
    updated[meetingIndex] = {
      ...updated[meetingIndex],
      speakerEmails: emails.length > 0 ? emails : undefined,
    };
    setMeetings(updated);

    // Update input field
    const updatedInputs = [...meetingSpeakerEmailInputs];
    updatedInputs[meetingIndex] = emails.join(" ");
    setMeetingSpeakerEmailInputs(updatedInputs);
  };

  // When enabling Meet, ensure at least one meeting slot exists
  useEffect(() => {
    if (includeMeet && meetings.length === 0) {
      setMeetings([
        { startDate: null, timezone: "Asia/Jakarta", speakerEmails: [] },
      ]);
    }
  }, [includeMeet, meetings.length]);

  // Sync form state to block data on every change so editor save captures current values
  useEffect(() => {
    onSave({
      name,
      price,
      includeMeet,
      includeDrive,
      meetings: includeMeet
        ? meetings.slice(0, MAX_MEETINGS_PER_EVENT).map((m) => ({
            startDate: m.startDate,
            timezone: m.timezone,
            speakerEmails:
              m.speakerEmails && m.speakerEmails.length > 0
                ? m.speakerEmails
                : undefined,
          }))
        : [],
      driveFolder: {
        path: includeDrive ? driveFolderPath : "",
        speakerEmails:
          includeDrive && driveFolderSpeakerEmailsInput.trim()
            ? parseEmails(driveFolderSpeakerEmailsInput).filter(isValidEmail)
            : undefined,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSave is stable from block instance
  }, [
    name,
    price,
    includeMeet,
    includeDrive,
    meetings,
    driveFolderPath,
    driveFolderSpeakerEmailsInput,
  ]);

  return (
    <div className="border rounded-lg p-4 pt-2 bg-white space-y-4 not-prose my-2">
      <div className="-space-y-4">
        <Input
          type="text"
          value={name}
          className="border-none focus-visible:ring-0 shadow-none text-lg! font-semibold p-0!"
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
        />
        <Input
          type="number"
          value={price}
          className="border-none focus-visible:ring-0 shadow-none p-0!"
          onChange={(e) =>
            setPrice(Math.max(0, Number(e.target.value) || 0))
          }
          placeholder="Price (IDR, 0 for free)"
        />
      </div>
      <div className="space-y-4">
        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={includeMeet} onCheckedChange={setIncludeMeet} />
            <span className="text-sm font-medium flex items-center gap-2">
              <Image
                src="/icons/meet.svg"
                alt="Google Meet"
                width={20}
                height={20}
              />
              Meet
            </span>
          </label>
          {includeMeet && (
            <div>
              {!hasCalendarScope ? (
                <p className="text-sm text-muted-foreground">
                  Calendar access required.{" "}
                  <button
                    type="button"
                    onClick={() =>
                      authClient.linkSocial({
                        provider: "google",
                        scopes: [
                          "https://www.googleapis.com/auth/calendar.app.created",
                        ],
                      })
                    }
                  >
                    Grant Google Calendar access
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  {Array.isArray(meetings)
                    ? meetings.map((meeting, index) => (
                        <div key={index} className="space-y-2">
                          <div className="flex items-center border w-fit rounded-lg pr-1 overflow-hidden">
                            <DatePicker
                              selected={meeting.startDate}
                              onChange={(date) =>
                                updateMeeting(index, "startDate", date)
                              }
                              showTimeSelect
                              dateFormat="MMMM d, yyyy h:mm aa"
                              className="border-none px-3 py-2 text-sm"
                              placeholderText="Select datetime"
                            />
                            <Select
                              value={meeting.timezone}
                              onValueChange={(value) =>
                                updateMeeting(index, "timezone", value)
                              }
                            >
                              <SelectTrigger className="border-none shadow-none w-fit">
                                <SelectValue placeholder="Theme" />
                              </SelectTrigger>
                              <SelectContent>
                                {timezones.map((tz) => (
                                  <SelectItem key={tz} value={tz}>
                                    {tz}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {meetings.length > 1 && (
                              <Button
                                onClick={() => removeMeeting(index)}
                                size="icon-sm"
                                variant="ghost"
                              >
                                <X />
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Input
                              type="text"
                              value={meetingSpeakerEmailInputs[index] || ""}
                              onChange={(e) =>
                                updateMeetingSpeakerEmails(
                                  index,
                                  e.target.value,
                                )
                              }
                              placeholder="Email invitation (space-separated, max 3, optional)"
                              className="text-sm w-full"
                            />
                            {meeting.speakerEmails &&
                              meeting.speakerEmails.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {meeting.speakerEmails.map(
                                    (email, emailIndex) => (
                                      <Badge
                                        key={emailIndex}
                                        variant="secondary"
                                        className="text-xs flex items-center gap-1"
                                      >
                                        <span>{email}</span>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeMeetingSpeakerEmail(
                                              index,
                                              emailIndex,
                                            )
                                          }
                                          className="ml-0.5 hover:text-destructive rounded-full hover:bg-destructive/10 p-0.5"
                                          aria-label={`Remove ${email}`}
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      </Badge>
                                    ),
                                  )}
                                </div>
                              )}
                            {parseEmails(meetingSpeakerEmailInputs[index] || "")
                              .length > MAX_SPEAKER_EMAILS && (
                              <p className="text-xs text-muted-foreground">
                                Max {MAX_SPEAKER_EMAILS} emails allowed
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    : null}
                  <Button
                    onClick={addMeeting}
                    size="sm"
                    disabled={meetings.length >= MAX_MEETINGS_PER_EVENT}
                  >
                    <Plus /> Add meeting
                  </Button>
                  {meetings.length >= MAX_MEETINGS_PER_EVENT && (
                    <p className="text-xs text-muted-foreground">
                      Max {MAX_MEETINGS_PER_EVENT} Meet sessions per event.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <Switch checked={includeDrive} onCheckedChange={setIncludeDrive} />
            <span className="text-sm font-medium flex items-center gap-2">
              <Image
                src="/icons/drive.svg"
                alt="Google Drive"
                width={16}
                height={16}
              />
              Drive
            </span>
          </label>
          {includeDrive && (
            <>
              {!hasDriveScope ? (
                <p className="text-sm text-muted-foreground">
                  Drive access required.{" "}
                  <button
                    type="button"
                    onClick={() =>
                      authClient.linkSocial({
                        provider: "google",
                        scopes: ["https://www.googleapis.com/auth/drive.file"],
                      })
                    }
                  >
                    Grant Google Drive access
                  </button>
                </p>
              ) : (
                <div className="space-y-2">
                  <Input
                    value={driveFolderPath}
                    onChange={(e) => setDriveFolderPath(e.target.value)}
                    placeholder="Folder name or path"
                  />
                  <div className="space-y-2">
                    <Input
                      type="text"
                      value={driveFolderSpeakerEmailsInput}
                      onChange={(e) =>
                        setDriveFolderSpeakerEmailsInput(e.target.value)
                      }
                      placeholder="Speaker emails (space-separated, max 3)"
                      className="text-sm"
                    />
                    {parseEmails(driveFolderSpeakerEmailsInput).filter(
                      isValidEmail,
                    ).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {parseEmails(driveFolderSpeakerEmailsInput)
                          .filter(isValidEmail)
                          .map((email, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs flex items-center gap-1"
                            >
                              <span>{email}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const emails = parseEmails(
                                    driveFolderSpeakerEmailsInput,
                                  ).filter(isValidEmail);
                                  emails.splice(index, 1);
                                  setDriveFolderSpeakerEmailsInput(
                                    emails.join(" "),
                                  );
                                }}
                                className="ml-0.5 hover:text-destructive rounded-full hover:bg-destructive/10 p-0.5"
                                aria-label={`Remove ${email}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                      </div>
                    )}
                    {parseEmails(driveFolderSpeakerEmailsInput).length >
                      MAX_SPEAKER_EMAILS && (
                      <p className="text-xs text-muted-foreground">
                        Max {MAX_SPEAKER_EMAILS} emails allowed
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

class PackageTool {
  private data: PackageData;
  private wrapper: HTMLElement | null = null;
  private root: Root | null = null;

  static get toolbox() {
    return {
      title: "Package",
      icon: renderToStaticMarkup(<Package size={14} />),
    };
  }

  constructor({ data }: { data: PackageData }) {
    const defaults: PackageData = {
      name: "",
      price: 0,
      includeMeet: false,
      includeDrive: false,
      meetings: [
        { startDate: null, timezone: "Asia/Jakarta", speakerEmails: [] },
      ],
      driveFolder: { path: "", speakerEmails: undefined },
    };

    const rawMeetings = Array.isArray(data?.meetings)
      ? data!.meetings
      : defaults.meetings;
    const savedMeetings = rawMeetings.map(
      (m: MeetingSession & { startDate?: Date | string | null }) => ({
        startDate: m.startDate
          ? m.startDate instanceof Date
            ? m.startDate
            : new Date(m.startDate as string)
          : null,
        timezone: m.timezone || "Asia/Jakarta",
        speakerEmails: Array.isArray(m.speakerEmails)
          ? m.speakerEmails
          : (m as any).speakerEmail
            ? [(m as any).speakerEmail]
            : [],
      }),
    );
    const savedDrive = data?.driveFolder ?? defaults.driveFolder;
    // Backfill for blocks saved before includeMeet/includeDrive existed
    const includeMeet = data?.includeMeet ?? savedMeetings.length > 0;
    const includeDrive = data?.includeDrive ?? !!savedDrive?.path;

    this.data = {
      name: data?.name ?? defaults.name,
      price: data?.price ?? defaults.price,
      includeMeet,
      includeDrive,
      meetings: savedMeetings,
      driveFolder: savedDrive,
    };
  }

  render() {
    this.wrapper = document.createElement("div");

    this.root = createRoot(this.wrapper);
    this.root.render(
      <TRPCLayout>
        <PackageForm
          initialData={this.data}
          onSave={(data) => {
            this.data = data;
          }}
        />
      </TRPCLayout>,
    );

    return this.wrapper;
  }

  save() {
    const meetingsArray = Array.isArray(this.data.meetings)
      ? this.data.meetings
      : [];
    const includeMeet = this.data.includeMeet ?? false;
    const includeDrive = this.data.includeDrive ?? false;

    return {
      name: this.data.name || "",
      price: this.data.price || 0,
      includeMeet,
      includeDrive,
      meetings: includeMeet
        ? meetingsArray.map((m) => ({
            startDate: m.startDate ? formatLocalDateTime(m.startDate) : null,
            timezone: m.timezone || "Asia/Jakarta",
            speakerEmails:
              m.speakerEmails && m.speakerEmails.length > 0
                ? m.speakerEmails
                : undefined,
          }))
        : [],
      driveFolder: includeDrive
        ? {
            path: this.data.driveFolder?.path || "",
            speakerEmails:
              this.data.driveFolder?.speakerEmails &&
              this.data.driveFolder.speakerEmails.length > 0
                ? this.data.driveFolder.speakerEmails
                : undefined,
          }
        : { path: "", speakerEmails: undefined },
    };
  }

  validate(savedData: any) {
    if (!savedData.name) {
      return false;
    }
    if (typeof savedData.price !== "number") {
      return false;
    }
    if (savedData.price < 0) {
      return false;
    }
    return true;
  }

  static get isReadOnlySupported() {
    return true;
  }
}

export default PackageTool;

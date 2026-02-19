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
}

const MAX_MEETINGS_PER_EVENT = 3;

interface PackageData {
  name: string;
  price: number;
  includeMeet: boolean;
  includeDrive: boolean;
  meetings: MeetingSession[];
  driveFolder: { path: string };
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
    ? initialData.meetings.slice(0, MAX_MEETINGS_PER_EVENT)
    : [{ startDate: null, timezone: "Asia/Jakarta" }];

  const [meetings, setMeetings] = useState<MeetingSession[]>(initialMeetings);

  const [driveFolderPath, setDriveFolderPath] = useState(
    initialData.driveFolder?.path || "",
  );

  const timezones = ["Asia/Jakarta", "Asia/Singapore"];

  const addMeeting = () => {
    if (meetings.length >= MAX_MEETINGS_PER_EVENT) return;
    setMeetings([...meetings, { startDate: null, timezone: "Asia/Jakarta" }]);
  };

  const removeMeeting = (index: number) => {
    setMeetings(meetings.filter((_, i) => i !== index));
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

  // When enabling Meet, ensure at least one meeting slot exists
  useEffect(() => {
    if (includeMeet && meetings.length === 0) {
      setMeetings([{ startDate: null, timezone: "Asia/Jakarta" }]);
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
        ? meetings.slice(0, MAX_MEETINGS_PER_EVENT)
        : [],
      driveFolder: { path: includeDrive ? driveFolderPath : "" },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onSave is stable from block instance
  }, [name, price, includeMeet, includeDrive, meetings, driveFolderPath]);

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
          onChange={(e) => setPrice(Number(e.target.value) || 0)}
          placeholder="Price (IDR)"
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
                          "https://www.googleapis.com/auth/calendar.events",
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
                        <div
                          key={index}
                          className="flex items-center border w-fit rounded-lg pr-1 overflow-hidden"
                        >
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
                    className="text-blue-600 hover:underline"
                  >
                    Grant Google Drive access
                  </button>
                </p>
              ) : (
                <Input
                  value={driveFolderPath}
                  onChange={(e) => setDriveFolderPath(e.target.value)}
                  placeholder="Folder name or path"
                />
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
      meetings: [{ startDate: null, timezone: "Asia/Jakarta" }],
      driveFolder: { path: "" },
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
            startDate: m.startDate?.toISOString() || null,
            timezone: m.timezone || "Asia/Jakarta",
          }))
        : [],
      driveFolder: includeDrive
        ? this.data.driveFolder || { path: "" }
        : { path: "" },
    };
  }

  validate(savedData: any) {
    if (!savedData.name || !savedData.price) {
      return false;
    }
    return true;
  }

  static get isReadOnlySupported() {
    return true;
  }
}

export default PackageTool;

import { google } from "googleapis";
import { getGoogleClient } from "./client";

export async function createMeetEvent(params: {
  userId: string;
  startDate: string;
  timezone: string;
  summary: string;
  durationMinutes?: number;
}) {
  const { userId, startDate, timezone, summary, durationMinutes = 60 } = params;

  const client = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const startDateTime = new Date(startDate);
  const endDateTime = new Date(
    startDateTime.getTime() + durationMinutes * 60000,
  );

  const event = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: timezone,
      },
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
        },
      },
    },
  });

  return {
    meetingId: event.data.id!,
    hangoutLink: event.data.hangoutLink!,
    startDateTime: event.data.start?.dateTime!,
  };
}

export async function updateMeetEvent(params: {
  userId: string;
  meetingId: string;
  startDate: string;
  timezone: string;
  summary: string;
  durationMinutes?: number;
}) {
  const {
    userId,
    meetingId,
    startDate,
    timezone,
    summary,
    durationMinutes = 60,
  } = params;

  const client = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth: client });

  const startDateTime = new Date(startDate);
  const endDateTime = new Date(
    startDateTime.getTime() + durationMinutes * 60000,
  );

  await calendar.events.patch({
    calendarId: "primary",
    eventId: meetingId,
    requestBody: {
      summary,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: timezone,
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: timezone,
      },
    },
    // This ensures Google Calendar sends reschedule emails to attendees
    sendUpdates: "all",
  });
}

export async function cancelMeetEvent(params: {
  userId: string;
  meetingId: string;
}) {
  const { userId, meetingId } = params;

  const client = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth: client });

  await calendar.events.delete({
    calendarId: "primary",
    eventId: meetingId,
    // Notify all attendees that the event was cancelled
    sendUpdates: "all",
  });
}

export async function addAttendeeToMeet(params: {
  userId: string;
  meetingId: string;
  attendeeEmail: string;
}) {
  const { userId, meetingId, attendeeEmail } = params;

  const client = await getGoogleClient(userId);
  const calendar = google.calendar({ version: "v3", auth: client });

  // Get existing event
  const event = await calendar.events.get({
    calendarId: "primary",
    eventId: meetingId,
  });

  const existingAttendees = event.data.attendees || [];

  // Add new attendee
  await calendar.events.patch({
    calendarId: "primary",
    eventId: meetingId,
    requestBody: {
      attendees: [
        ...existingAttendees,
        { email: attendeeEmail, responseStatus: "needsAction" },
      ],
    },
    sendUpdates: "all",
  });
}

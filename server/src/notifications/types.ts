// ordered by how much the person is waiting on it: when the daily cap bites, the front of this list wins
export const NOTIFICATION_KINDS = [
  "report_ready",
  "resume_ready",
  "deadline",
  "road_nudge",
  "interview_question",
  "company_news",
  "feed_match",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const isNotificationKind = (value: unknown): value is NotificationKind => NOTIFICATION_KINDS.includes(value as NotificationKind);

// where a tap lands; the apps map each to a screen they already have
export type NotificationTarget =
  | { type: "feed"; id: string }
  | { type: "company"; slug: string }
  | { type: "step"; id: string }
  | { type: "report"; id: string }
  | { type: "resume"; id: string };

/** Something the generator would like to say, before the cap, the toggles and dedupe have had their say. */
export type Candidate = {
  kind: NotificationKind;
  // the same fact always yields the same key, so it is said once however many times the generator runs
  key: string;
  title: string;
  body: string;
  target: NotificationTarget;
};

// pushed: APNs already took it, so an app that has push working shouldn't post it again as a local notification
export type Notification = Omit<Candidate, "key"> & { id: string; createdAt: string; readAt: string | null; pushed: boolean };

export type NotificationSettings = { timezone: string | null; disabled: NotificationKind[]; checkedAt: string | null };

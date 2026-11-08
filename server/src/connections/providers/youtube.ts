import { firstArray, isFields, isoDate, monthYear, safeName, summaryFrom } from "../text";
import type { Connector, WorkItem } from "../types";
import { TOP_ITEMS } from "./code-repos";

type Video = WorkItem & { described: boolean };

// Videos from the person's own channel. Kept: title, the first sentence of the description, publish date.
// Only videos that say they are public: an unlisted or private upload, or one whose privacy we can't see, stays out.
function videoFrom(raw: unknown): Video | undefined {
  if (!isFields(raw) || !isFields(raw.snippet)) return undefined;
  if (!isFields(raw.status) || raw.status.privacyStatus !== "public") return undefined;
  const name = safeName(raw.snippet.title);
  if (!name) return undefined;
  const updatedAt = isoDate(raw.snippet.publishedAt);
  const described = summaryFrom(raw.snippet.description);
  const summary = described ?? (updatedAt ? `YouTube video, published ${monthYear(updatedAt)}` : "YouTube video");
  return { name, summary, kind: "Video", topics: [], updatedAt, described: Boolean(described) };
}

function videoSuggestions(videos: Video[]): string[] {
  const out = videos.filter((v) => !v.described).map((v) => `Add a description to "${v.name}" that says what you made and what viewers learn.`);
  if (videos.length > 1) out.push("Put your best videos in one playlist you can link from your resume.");
  else if (videos.length === 1) out.push(`Pin "${videos[0].name}" to the top of your channel so it's the first thing people see.`);
  return out.slice(0, 3);
}

export const youtube: Connector = {
  id: "youtube",
  name: "YouTube",
  category: "video",
  toolkit: "youtube",
  toolkitVersion: "20261101_00",
  reads: "Reads your channel's public videos. Never uploads or comments.",
  readTools: ["YOUTUBE_LIST_CHANNEL_VIDEOS"],
  async importItems(read) {
    const data = await read("YOUTUBE_LIST_CHANNEL_VIDEOS", { mine: true, part: "snippet,status", maxResults: 25 });
    const videos = firstArray(data)
      .map(videoFrom)
      .filter((v): v is Video => v !== undefined)
      .slice(0, TOP_ITEMS);
    return { items: videos.map(({ described: _described, ...item }) => item), suggestions: videoSuggestions(videos) };
  },
};

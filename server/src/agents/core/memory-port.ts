import { connectedAppsFor, readToolsFor, runAppRead } from "../../connections/app-tools";
import { getConnection } from "../../connections/store";
import type { Env } from "../../env";
import { recall, remember } from "../../memory/private/store";
import { getProfile, updateProfile } from "../../memory/profile/store";
import type { PrivateMemoryPort } from "./types";

// bound to one user up front, so no tool can ever pass in someone else's id
export function memoryFor(env: Env, userId: string): PrivateMemoryPort {
  return {
    recall: (opts) => recall(env, userId, opts),
    remember: (item) => remember(env, userId, item),
    profile: () => getProfile(env, userId),
    updateProfile: (patch) => updateProfile(env, userId, patch),
    githubProjects: async () => {
      const connection = await getConnection(env, userId, "github");
      return connection?.status === "active" ? (connection.derived?.items ?? []) : [];
    },
    apps: {
      list: () => connectedAppsFor(env, userId),
      readTools: (app, search) => readToolsFor(env, userId, app, search),
      read: (app, tool, args) => runAppRead(env, userId, app, tool, args),
    },
  };
}

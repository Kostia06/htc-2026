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
  };
}

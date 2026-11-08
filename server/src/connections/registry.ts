import { github } from "./github/connector";
import { bitbucket } from "./providers/bitbucket";
import { dribbble } from "./providers/dribbble";
import { gitlab } from "./providers/gitlab";
import { googledrive } from "./providers/googledrive";
import { notion } from "./providers/notion";
import { youtube } from "./providers/youtube";
import { PROVIDERS, type Connector, type ProviderId } from "./types";

// Offering a service means adding its connector here, with an importer behind it: nothing is listed that can't import.
const BY_ID: Record<ProviderId, Connector> = { github, gitlab, bitbucket, dribbble, notion, googledrive, youtube };

/** In the order the UI lists them. */
export const CONNECTORS: readonly Connector[] = PROVIDERS.map((id) => BY_ID[id]);

export const connectorFor = (id: string): Connector | undefined => (Object.hasOwn(BY_ID, id) ? BY_ID[id as ProviderId] : undefined);

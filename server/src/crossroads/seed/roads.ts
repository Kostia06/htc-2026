// Example trails (flagged, never counted) and the real Calgary employers the research agent is pointed at.
// Self-contained so scripts/seed-crossroads.mjs can import it straight into Node.
export type SeedTrail = { lane: string; role: string; steps: string[]; skills: string[] };

export const seedTrails: SeedTrail[] = [
  { lane: "software", role: "junior software developer", steps: ["course", "project", "event", "project", "interview_practice", "application"], skills: ["javascript", "git", "sql"] },
  { lane: "software", role: "co-op developer", steps: ["project", "networking_practice", "interview_practice", "application"], skills: ["python", "git"] },
  { lane: "data", role: "junior data analyst", steps: ["course", "certification", "project", "volunteering", "interview_practice", "application"], skills: ["sql", "excel", "power bi"] },
  { lane: "data", role: "business intelligence analyst", steps: ["course", "project", "networking_practice", "application", "interview_practice"], skills: ["sql", "tableau"] },
  { lane: "finance", role: "staff accountant", steps: ["course", "certification", "networking_practice", "interview_practice", "application"], skills: ["excel", "accounting"] },
  { lane: "finance", role: "financial analyst", steps: ["course", "project", "event", "networking_practice", "interview_practice", "application"], skills: ["excel", "financial modelling"] },
  { lane: "marketing", role: "marketing coordinator", steps: ["certification", "volunteering", "project", "interview_practice", "application"], skills: ["social media", "google analytics", "copywriting"] },
  { lane: "marketing", role: "content specialist", steps: ["project", "project", "networking_practice", "application"], skills: ["copywriting", "seo"] },
  { lane: "design", role: "junior ux designer", steps: ["course", "project", "event", "project", "interview_practice", "application"], skills: ["figma", "user research"] },
  { lane: "design", role: "graphic designer", steps: ["project", "volunteering", "event", "application"], skills: ["adobe illustrator", "typography"] },
  { lane: "health", role: "registered nurse", steps: ["certification", "volunteering", "networking_practice", "interview_practice", "application"], skills: ["patient care", "bls"] },
  { lane: "health", role: "health care aide", steps: ["course", "certification", "volunteering", "application"], skills: ["patient care", "first aid"] },
  { lane: "trades", role: "electrical apprentice", steps: ["course", "certification", "networking_practice", "application"], skills: ["safety tickets", "hand tools"] },
  { lane: "trades", role: "millwright apprentice", steps: ["certification", "event", "application", "interview_practice"], skills: ["safety tickets", "mechanical aptitude"] },
  { lane: "education", role: "elementary teacher", steps: ["volunteering", "certification", "networking_practice", "interview_practice", "application"], skills: ["classroom management", "lesson planning"] },
  { lane: "education", role: "educational assistant", steps: ["course", "volunteering", "application"], skills: ["patience", "special needs support"] },
  { lane: "changer", role: "project coordinator", steps: ["course", "certification", "volunteering", "networking_practice", "application"], skills: ["project management", "communication"] },
  { lane: "changer", role: "customer success associate", steps: ["course", "event", "networking_practice", "interview_practice", "application"], skills: ["communication", "crm"] },
];

/** Real Calgary employers, one or two per road. Research facts about them keep their source links. */
export type SeedEmployer = { slug: string; name: string; website: string; lane: string };

export const calgaryEmployers: SeedEmployer[] = [
  { slug: "westjet", name: "WestJet", website: "https://www.westjet.com", lane: "software" },
  { slug: "pason", name: "Pason Systems", website: "https://www.pason.com", lane: "software" },
  { slug: "arcurve", name: "Arcurve", website: "https://www.arcurve.com", lane: "data" },
  { slug: "enmax", name: "ENMAX", website: "https://www.enmax.com", lane: "trades" },
  { slug: "suncor", name: "Suncor Energy", website: "https://www.suncor.com", lane: "trades" },
  { slug: "alberta-health-services", name: "Alberta Health Services", website: "https://www.albertahealthservices.ca", lane: "health" },
  { slug: "calgary-board-of-education", name: "Calgary Board of Education", website: "https://www.cbe.ab.ca", lane: "education" },
  { slug: "atb-financial", name: "ATB Financial", website: "https://www.atb.com", lane: "finance" },
  { slug: "calgary-stampede", name: "Calgary Stampede", website: "https://www.calgarystampede.com", lane: "marketing" },
  { slug: "critical-mass", name: "Critical Mass", website: "https://www.criticalmass.com", lane: "design" },
  { slug: "city-of-calgary", name: "The City of Calgary", website: "https://www.calgary.ca", lane: "changer" },
];

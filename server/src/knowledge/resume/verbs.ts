// Action verbs grouped by what the bullet shows, so the coach can swap weak openers for specific ones.
import type { VerbGroup } from "./types";

export const actionVerbs: VerbGroup[] = [
    { group: "built / created", verbs: ["Built", "Created", "Designed", "Developed", "Launched", "Produced", "Wrote", "Coded", "Prototyped", "Established", "Founded", "Engineered"] },
    { group: "improved", verbs: ["Improved", "Reduced", "Increased", "Streamlined", "Automated", "Simplified", "Upgraded", "Accelerated", "Cut", "Optimised", "Revamped", "Strengthened"] },
    { group: "led", verbs: ["Led", "Managed", "Supervised", "Directed", "Coordinated", "Mentored", "Coached", "Delegated", "Headed", "Oversaw", "Championed", "Spearheaded"] },
    { group: "analysed", verbs: ["Analysed", "Evaluated", "Assessed", "Investigated", "Researched", "Measured", "Forecast", "Modelled", "Audited", "Identified", "Tested", "Calculated"] },
    { group: "communicated", verbs: ["Presented", "Wrote", "Edited", "Pitched", "Negotiated", "Persuaded", "Briefed", "Reported", "Translated", "Documented", "Published", "Facilitated"] },
    { group: "helped / served", verbs: ["Served", "Assisted", "Supported", "Resolved", "Advised", "Guided", "Welcomed", "Answered", "Advocated", "Referred", "Accommodated", "Responded"] },
    { group: "organised", verbs: ["Organised", "Planned", "Scheduled", "Arranged", "Tracked", "Catalogued", "Prioritised", "Budgeted", "Maintained", "Processed", "Reconciled", "Filed"] },
    { group: "cared (health)", verbs: ["Cared", "Administered", "Monitored", "Assessed", "Charted", "Treated", "Comforted", "Assisted", "Educated", "Triaged", "Documented", "Escalated"] },
    { group: "taught", verbs: ["Taught", "Trained", "Tutored", "Instructed", "Coached", "Mentored", "Designed", "Adapted", "Assessed", "Demonstrated", "Explained", "Inspired"] },
    { group: "hands-on / trades", verbs: ["Installed", "Repaired", "Maintained", "Operated", "Assembled", "Fabricated", "Welded", "Wired", "Framed", "Inspected", "Diagnosed", "Calibrated", "Serviced"] },
];

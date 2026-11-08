// finer than the roadmap's fields: "data analyst" and "React developer" share a field but not a road
export const LANES = ["software", "data", "finance", "marketing", "design", "health", "trades", "education", "changer"] as const;
export type Lane = (typeof LANES)[number];

export const LANE_NAMES: Record<Lane, string> = {
  software: "software",
  data: "data",
  finance: "business and finance",
  marketing: "marketing",
  design: "design and art",
  health: "health care",
  trades: "the trades",
  education: "education",
  changer: "a career change",
};

// checked in order: "health data analyst" is data before health, "UX designer" is design before software
const LANE_PATTERNS: [Lane, RegExp][] = [
  ["changer", /career change|switch(ing)? (careers|into)|transition|return(ing)? to work|newcomer|re-?enter/i],
  ["data", /\bdata\b|analyst|analytics|machine learning|\bml\b|\bbi\b|scientist|statistic/i],
  ["design", /design|\bux\b|\bui\b|artist|\bart\b|illustrat|animat|creative|photo|video|film/i],
  ["health", /nurs|health|medic|clinic|pharma|therap|dental|paramedic|care aide|lab tech/i],
  ["education", /teach|educat|tutor|instructor|early childhood|school|professor|librar/i],
  ["trades", /electric|plumb|weld|carpent|mechanic|millwright|hvac|apprentic|journeyman|technician|instrumentation|lineman/i],
  ["marketing", /market|brand|content|social media|\bseo\b|communications|copywrit|public relations|\bpr\b/i],
  ["finance", /financ|account|bank|audit|business|consult|operations|sales|\bhr\b|human resources|product manager|supply chain/i],
  ["software", /software|develop|engineer|programm|comput|cyber|security|devops|\bweb\b|cloud|\bit\b|\bqa\b|full.?stack|front.?end|back.?end/i],
];

export const isLane = (value: unknown): value is Lane => LANES.includes(value as Lane);

// a goal that names no road reads as someone still finding theirs, which is the career-changer road
export function laneOf(goal: string): Lane {
  return LANE_PATTERNS.find(([, pattern]) => pattern.test(goal))?.[0] ?? "changer";
}

// what a role is called when it is grouped with others: case and spacing never split a group
export const roleKey = (role: string) => role.trim().toLowerCase().replace(/\s+/g, " ");

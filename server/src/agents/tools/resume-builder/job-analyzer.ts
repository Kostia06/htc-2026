import type { Env } from "../../../env";
import { searchAdzunaJobs } from "../../../integrations/adzuna";
import { generateJson } from "../../../integrations/gemini";

// TYPES
export type JobSkill = {
    name: string;
    category: string;
    requiredCount: number;
    preferredCount: number;
    postingCount: number;
    demandPercent: number;
};

export type JobAnalysis = {
    targetRole: string;
    location: string;
    totalResults: number;
    postingsAnalyzed: number;
    skills: JobSkill[];
    responsibilities: { name: string; frequency: number }[];
    qualifications: { name: string; frequency: number }[];
    sources: {
        id: string;
        title: string;
        company: string | null;
        url: string | null;
        description: string;
    }[];
    retrievedAt: string;
};

type ExtractedSkill = {
    name: string;
    category: string;
};

type ExtractedPosting = {
    jobId: string;
    requiredSkills: ExtractedSkill[];
    preferredSkills: ExtractedSkill[];
    responsibilities: string[];
    qualifications: string[];
};

type ExtractionResponse = {
    postings: ExtractedPosting[];
};

// We ask Gemini to extract requirements separately for each posting. This lets us calculate frequency accurately later.
const EXTRACTION_SCHEMA = {
    type: "object",
    properties: {
        postings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    jobId: { type: "string" },
                    requiredSkills: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                category: { type: "string" },
                            },
                            required: ["name", "category"],
                        },
                    },
                    preferredSkills: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                category: { type: "string" },
                            },
                            required: ["name", "category"],
                        },
                    },
                    responsibilities: {
                        type: "array",
                        items: { type: "string" },
                    },
                    qualifications: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: [
                    "jobId",
                    "requiredSkills",
                    "preferredSkills",
                    "responsibilities",
                    "qualifications",
                ],
            },
        },
    },
    required: ["postings"],
};

// Helper functions

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Remove duplicates without changing the display name.
function uniqueStrings(values: string[]): string[] {
    const seen = new Set<string>();

    return values.filter((value) => {
        const key = normalizeKey(value);

        if (!key || seen.has(key)) return false;

        seen.add(key);
        return true;
    });
}


// Main job analysis function

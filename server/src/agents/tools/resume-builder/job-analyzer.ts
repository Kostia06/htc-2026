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
export async function analyzeJobMarket(
    env: Env,
    options: {
        targetRole: string;
        location?: string;
        maxJobs?: number;
    }
): Promise<JobAnalysis> {
    const targetRole = options.targetRole.trim();
    const location = options.location?.trim() || "Calgary";
    const maxJobs = options.maxJobs ?? 20;

    if (!targetRole || targetRole.length > 100) {
        throw new Error("A valid target job title is required.");
    }

    if (!location || location.length > 100) {
        throw new Error("A valid location is required.");
    }

    if (
        !Number.isInteger(maxJobs) ||
        maxJobs < 1 ||
        maxJobs > 50
    ) {
        throw new Error("maxJobs must be between 1 and 50.");
    }

    // STEP 1: Retrieve real job postings from Adzuna.
    const result = await searchAdzunaJobs(env, {
        query: targetRole,
        location,
        page: 1,
        resultsPerPage: maxJobs,
    });

    // We cannot analyze requirements if no postings were found.
    if (result.jobs.length === 0) {
        return {
            targetRole,
            location,
            totalResults: result.count,
            postingsAnalyzed: 0,
            skills: [],
            responsibilities: [],
            qualifications: [],
            sources: [],
            retrievedAt: new Date().toISOString(),
        };
    }

    // STEP 2: Prepare the job information for Gemini.
    // Adzuna descriptions may be snippets, not complete descriptions.
    const jobInput = result.jobs.map((job) => ({
        jobId: job.id,
        title: job.title,
        company: job.company,
        description: job.description.slice(0, 2500),
    }));

    // STEP 3: Ask Gemini to extract requirements.
    // default prompt to ask gemini
    const prompt = `
You are a labour-market research analyst.

Analyze the supplied job advertisements for:
${targetRole} in ${location}.

For EACH supplied job, extract:

1. Required technical and professional skills.
2. Preferred or nice-to-have skills.
3. Main job responsibilities.
4. Qualifications and experience requirements.

Rules:

- Only extract information explicitly supported by the supplied text.
- Do not invent requirements.
- Distinguish required skills from preferred skills.
- Keep skill names consistent across advertisements.
- Categorize skills as technical, tool, soft, domain, credential, or other.
- Do not treat a job title as proof of a skill requirement.
- The descriptions may be incomplete snippets. Do not assume
  that a skill is absent from the full advertisement simply
  because it is absent from the supplied snippet.
- Return one result for each supplied job.
- Preserve the supplied jobId exactly.

JOB ADVERTISEMENTS:

${JSON.stringify(jobInput)}
`;

    const extraction = await generateJson<ExtractionResponse>(
        env,
        prompt,
        EXTRACTION_SCHEMA
    );

    // STEP 4: Match extracted results to actual postings.
    // Ignore any job IDs that Gemini did not receive.
    const validJobIds = new Set(
        result.jobs.map((job) => job.id)
    );

    const extractedPostings = extraction.postings.filter(
        (posting) => validJobIds.has(posting.jobId)
    );

    // STEP 5: Aggregate skill demand ourselves.
    type SkillAccumulator = {
        name: string;
        category: string;
        requiredIds: Set<string>;
        preferredIds: Set<string>;
    };

    const skillMap = new Map<string, SkillAccumulator>();

    for (const posting of extractedPostings) {
        for (const skill of posting.requiredSkills) {
            const name = skill.name.trim();
            const key = normalizeKey(name);

            if (!key) continue;

            if (!skillMap.has(key)) {
                skillMap.set(key, {
                    name,
                    category: skill.category,
                    requiredIds: new Set(),
                    preferredIds: new Set(),
                });
            }

            skillMap.get(key)!.requiredIds.add(posting.jobId);
        }

        for (const skill of posting.preferredSkills) {
            const name = skill.name.trim();
            const key = normalizeKey(name);

            if (!key) continue;

            if (!skillMap.has(key)) {
                skillMap.set(key, {
                    name,
                    category: skill.category,
                    requiredIds: new Set(),
                    preferredIds: new Set(),
                });
            }

            skillMap.get(key)!.preferredIds.add(posting.jobId);
        }
    }

    // Calculate how many distinct postings mention each skill.
    const postingsAnalyzed = extractedPostings.length;

    const skills: JobSkill[] = Array.from(skillMap.values())
        .map((skill) => {
            const postingCount = new Set([
                ...skill.requiredIds,
                ...skill.preferredIds,
            ]).size;

            return {
                name: skill.name,
                category: skill.category,
                requiredCount: skill.requiredIds.size,
                preferredCount: skill.preferredIds.size,
                postingCount,
                demandPercent:
                    postingsAnalyzed > 0
                        ? Number(
                            ((postingCount / postingsAnalyzed) * 100).toFixed(1)
                        )
                        : 0,
            };
        })
        .sort(
            (a, b) =>
                b.requiredCount - a.requiredCount ||
                b.postingCount - a.postingCount
        );

    // STEP 6: Aggregate recurring responsibilities and qualifications.
    function aggregateText(
        values: string[],
        denominator: number
    ) {
        const counts = new Map<string, {
            name: string;
            frequency: number;
        }>();

        for (const value of values) {
            const name = value.trim();
            const key = normalizeKey(name);

            if (!key) continue;

            const existing = counts.get(key);

            if (existing) {
                existing.frequency++;
            } else {
                counts.set(key, { name, frequency: 1 });
            }
        }

        return Array.from(counts.values())
            .map((item) => ({
                ...item,
                frequency:
                    denominator > 0
                        ? Number((item.frequency / denominator * 100).toFixed(1))
                        : 0,
            }))
            .sort((a, b) => b.frequency - a.frequency);
    }

    const responsibilities = aggregateText(
        extractedPostings.flatMap((p) => p.responsibilities),
        postingsAnalyzed
    );

    const qualifications = aggregateText(
        extractedPostings.flatMap((p) => p.qualifications),
        postingsAnalyzed
    );

    // STEP 7: Preserve source links for traceability.
    const sources = result.jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        url: job.redirectUrl,
        description: job.description,
    }));

    return {
        targetRole,
        location,
        totalResults: result.count,
        postingsAnalyzed,
        skills,
        responsibilities,
        qualifications,
        sources,
        retrievedAt: new Date().toISOString(),
    };
}
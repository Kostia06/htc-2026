
import type { Env } from "../../../env";
import { generateJson } from "../../../integrations/gemini";

// TYPES

export type ResumeSkill = {
    name: string;
    evidence: string[];
    proficiencyEvidence: string;
};

export type ResumeExperience = {
    role: string;
    organization: string;
    dates: string;
    responsibilities: string[];
    achievements: string[];
};

export type ResumeProject = {
    name: string;
    description: string;
    technologies: string[];
    contributions: string[];
    outcomes: string[];
};

export type ResumeEducation = {
    credential: string;
    institution: string;
    dates: string;
    details: string[];
};

export type ResumeAnalysis = {
    professionalHeadline: string;
    skills: ResumeSkill[];
    experience: ResumeExperience[];
    projects: ResumeProject[];
    education: ResumeEducation[];
    certifications: string[];
};

// GEMINI RESPONSE SCHEMA
const RESUME_SCHEMA = {
    type: "object",
    properties: {
        professionalHeadline: { type: "string" },

        skills: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    evidence: {
                        type: "array",
                        items: { type: "string" },
                    },
                    proficiencyEvidence: { type: "string" },
                },
                required: [
                    "name",
                    "evidence",
                    "proficiencyEvidence",
                ],
            },
        },

        experience: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    role: { type: "string" },
                    organization: { type: "string" },
                    dates: { type: "string" },
                    responsibilities: {
                        type: "array",
                        items: { type: "string" },
                    },
                    achievements: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: [
                    "role",
                    "organization",
                    "dates",
                    "responsibilities",
                    "achievements",
                ],
            },
        },

        projects: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    technologies: {
                        type: "array",
                        items: { type: "string" },
                    },
                    contributions: {
                        type: "array",
                        items: { type: "string" },
                    },
                    outcomes: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: [
                    "name",
                    "description",
                    "technologies",
                    "contributions",
                    "outcomes",
                ],
            },
        },

        education: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    credential: { type: "string" },
                    institution: { type: "string" },
                    dates: { type: "string" },
                    details: {
                        type: "array",
                        items: { type: "string" },
                    },
                },
                required: [
                    "credential",
                    "institution",
                    "dates",
                    "details",
                ],
            },
        },

        certifications: {
            type: "array",
            items: { type: "string" },
        },
    },

    required: [
        "professionalHeadline",
        "skills",
        "experience",
        "projects",
        "education",
        "certifications",
    ],
};

// MAIN RESUME ANALYSIS FUNCTION
export async function analyzeResume(
    env: Env,
    options: {
        resumeText: string;
        targetRole?: string;
    }
): Promise<ResumeAnalysis> {
    const resumeText = options.resumeText.trim();
    const targetRole = options.targetRole?.trim();

    if (!resumeText) {
        throw new Error("Resume text cannot be empty.");
    }

    if (resumeText.length > 30000) {
        throw new Error(
            "Resume text is too long. Maximum length is 30,000 characters."
        );
    }

    // The target role helps us understand which information
    // is relevant, but it must not change the candidate's facts.
    const prompt = `
You are an expert resume analyst.

Analyze the following candidate resume.

${targetRole ? `Target role: ${targetRole}` : ""}

Extract the following:

1. Professional headline or current professional identity.
2. Technical and professional skills.
3. Work experience.
4. Projects and the candidate's contributions.
5. Education.
6. Certifications.

IMPORTANT RULES:

- Only extract information supported by the resume.
- Never invent employment, projects, qualifications or skills.
- Do not assume someone has advanced proficiency just because
  a technology appears in their skills list.
- For proficiencyEvidence, explain what the resume actually
  demonstrates. Return an empty string if there is no evidence.
- Preserve actual job titles, organizations and dates.
- Do not invent numerical achievements or percentages.
- Separate responsibilities from actual achievements.
- Do not convert participation into leadership.
- Do not mistake a desired skill for an existing skill.
- If a section is missing, return an empty array.
- Keep project contributions separate from project outcomes.

RESUME:

${resumeText}
`;

    return generateJson<ResumeAnalysis>(
        env,
        prompt,
        RESUME_SCHEMA
    );
}

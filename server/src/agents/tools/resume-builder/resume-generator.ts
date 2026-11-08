
import type { Env } from "../../../env";
import { generateJson } from "../../../integrations/gemini";
import type { JobAnalysis } from "./job-analyzer";
import type { ResumeAnalysis } from "./resume-analyzer";
import type { EvidenceMatchResult } from "./evidence-matcher";


// TYPES
export type GeneratedResumeBullet = {
    text: string;
    supportingEvidence: string;
};

export type GeneratedResumeExperience = {
    role: string;
    organization: string;
    dates: string;
    bullets: GeneratedResumeBullet[];
};

export type GeneratedResumeProject = {
    name: string;
    technologies: string[];
    bullets: GeneratedResumeBullet[];
};

export type TailoredResume = {
    targetRole: string;
    professionalSummary: string;
    technicalSkills: string[];
    experience: GeneratedResumeExperience[];
    projects: GeneratedResumeProject[];
    education: {
        credential: string;
        institution: string;
        dates: string;
    }[];
    certifications: string[];
    improvementNotes: string[];
    questionsForUser: string[];
    claimsToVerify: string[];
};

// GEMINI RESPONSE SCHEMA
const RESUME_GENERATION_SCHEMA = {
    type: "object",

    properties: {
        professionalSummary: {
            type: "string",
        },

        technicalSkills: {
            type: "array",
            items: { type: "string" },
        },

        experience: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    role: { type: "string" },
                    organization: { type: "string" },
                    dates: { type: "string" },

                    bullets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                text: { type: "string" },
                                supportingEvidence: { type: "string" },
                            },
                            required: ["text", "supportingEvidence"],
                        },
                    },
                },
                required: [
                    "role",
                    "organization",
                    "dates",
                    "bullets",
                ],
            },
        },

        projects: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    name: { type: "string" },

                    technologies: {
                        type: "array",
                        items: { type: "string" },
                    },

                    bullets: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                text: { type: "string" },
                                supportingEvidence: { type: "string" },
                            },
                            required: ["text", "supportingEvidence"],
                        },
                    },
                },
                required: ["name", "technologies", "bullets"],
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
                },
                required: ["credential", "institution", "dates"],
            },
        },

        certifications: {
            type: "array",
            items: { type: "string" },
        },

        improvementNotes: {
            type: "array",
            items: { type: "string" },
        },

        questionsForUser: {
            type: "array",
            items: { type: "string" },
        },

        claimsToVerify: {
            type: "array",
            items: { type: "string" },
        },
    },

    required: [
        "professionalSummary",
        "technicalSkills",
        "experience",
        "projects",
        "education",
        "certifications",
        "improvementNotes",
        "questionsForUser",
        "claimsToVerify",
    ],
};

// MAIN RESUME GENERATION FUNCTION
export async function generateTailoredResume(
    env: Env,
    options: {
        targetRole: string;
        resumeText: string;
        resumeAnalysis: ResumeAnalysis;
        jobAnalysis: JobAnalysis;
        evidenceMatch: EvidenceMatchResult;
    }
): Promise<TailoredResume> {
    const {
        targetRole,
        resumeText,
        resumeAnalysis,
        jobAnalysis,
        evidenceMatch,
    } = options;

    if (!targetRole.trim()) {
        throw new Error("Target role is required.");
    }

    if (!resumeText.trim()) {
        throw new Error("Original resume text is required.");
    }

    if (resumeText.length > 30000) {
        throw new Error("Resume text exceeds the maximum length.");
    }

    // Only include the most relevant market requirements.
    const topMarketSkills = jobAnalysis.skills
        .slice(0, 20)
        .map((skill) => ({
            name: skill.name,
            requiredCount: skill.requiredCount,
            preferredCount: skill.preferredCount,
            demandPercent: skill.demandPercent,
        }));

    // Give Gemini the evidence assessments so it knows
    // which resume content is strong and which needs attention.
    const prompt = `
You are an expert technical resume writer and career advisor.

Your task is to generate a highly personalized resume
for a specific job target.

TARGET ROLE:
${targetRole}

TARGET LOCATION:
${jobAnalysis.location}

ORIGINAL RESUME:
${resumeText}

STRUCTURED RESUME ANALYSIS:
${JSON.stringify(resumeAnalysis)}

JOB MARKET REQUIREMENTS:
${JSON.stringify(topMarketSkills)}

RESUME EVIDENCE ASSESSMENT:
${JSON.stringify(evidenceMatch)}

Your objective is to produce a strong, truthful,
job-relevant resume.

CONTENT RULES:

1. Never fabricate information.

2. Do not invent:
   - Work experience.
   - Projects.
   - Technical skills.
   - Certifications.
   - Job titles.
   - Employers.
   - Achievements.
   - Numerical results.
   - Performance improvements.
   - Leadership responsibilities.

3. Every generated experience and project bullet must have
   supportingEvidence taken from the original resume.

4. The supportingEvidence field must identify a real piece
   of information in the original resume. Prefer a short,
   verbatim excerpt.

5. If a claim cannot be supported by the original resume,
   do not include it as an established achievement.

6. You may improve wording, structure, clarity and emphasis.

7. Prioritize skills that are relevant to the target job
   and that the candidate can actually demonstrate.

8. Do not add a skill merely because it frequently appears
   in job postings.

9. Do not exaggerate proficiency.

10. Do not turn university assignments into professional
    employment.

11. Do not turn team participation into team leadership.

12. Do not invent percentages or measurable results.
    When a measurable result could improve a bullet, put
    a question in questionsForUser asking for the real metric.

13. Keep the resume concise and professional.

14. Use strong action verbs and explain what the candidate
    actually did, what technologies were used and what
    outcome was achieved when that outcome is documented.

15. Do not include unnecessary personal details.

RESUME STRUCTURE:

- Professional summary.
- Relevant technical skills.
- Work experience.
- Relevant projects.
- Education.
- Certifications.

IMPROVEMENT GUIDANCE:

Also provide:
- Content improvements made.
- Missing information worth asking the candidate about.
- Claims that should be verified before submitting.

The generated resume must remain an accurate representation
of the candidate.

Return only the requested structured JSON.
`;

    const result = await generateJson<
        Omit<TailoredResume, "targetRole">
    >(
        env,
        prompt,
        RESUME_GENERATION_SCHEMA
    );

    return {
        targetRole,
        ...result,
    };
}

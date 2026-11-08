
import type { Env } from "../../../env";
import { generateJson } from "../../../integrations/gemini";
import type { JobAnalysis } from "./job-analyzer";
import type { ResumeAnalysis } from "./resume-analyzer";


// TYPES


export type SkillEvidenceStatus =
    | "demonstrated"
    | "partially_demonstrated"
    | "not_evidenced";

export type SkillAssessment = {
    skill: string;
    importance: "required" | "preferred";
    demandPercent: number;
    status: SkillEvidenceStatus;
    resumeEvidence: string[];
    explanation: string;
    recommendedAction: string;
};

export type EvidenceMatchResult = {
    targetRole: string;
    skillAssessments: SkillAssessment[];
    overallStrengths: string[];
    topPriorities: string[];
    resumeContentIssues: string[];
};

// GEMINI RESPONSE SCHEMA


const MATCH_SCHEMA = {
    type: "object",
    properties: {
        skillAssessments: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    skill: { type: "string" },
                    importance: { type: "string" },
                    status: { type: "string" },
                    resumeEvidence: {
                        type: "array",
                        items: { type: "string" },
                    },
                    explanation: { type: "string" },
                    recommendedAction: { type: "string" },
                },
                required: [
                    "skill",
                    "importance",
                    "status",
                    "resumeEvidence",
                    "explanation",
                    "recommendedAction",
                ],
            },
        },

        overallStrengths: {
            type: "array",
            items: { type: "string" },
        },

        topPriorities: {
            type: "array",
            items: { type: "string" },
        },

        resumeContentIssues: {
            type: "array",
            items: { type: "string" },
        },
    },

    required: [
        "skillAssessments",
        "overallStrengths",
        "topPriorities",
        "resumeContentIssues",
    ],
};

// MAIN EVIDENCE MATCHING FUNCTION


export async function matchResumeEvidence(
    env: Env,
    options: {
        jobAnalysis: JobAnalysis;
        resumeAnalysis: ResumeAnalysis;
        maxSkills?: number;
    }
): Promise<EvidenceMatchResult> {
    const {
        jobAnalysis,
        resumeAnalysis,
        maxSkills = 25,
    } = options;

    if (!jobAnalysis.targetRole) {
        throw new Error("Target role is required.");
    }

    if (
        !Number.isInteger(maxSkills) ||
        maxSkills < 1 ||
        maxSkills > 50
    ) {
        throw new Error("maxSkills must be between 1 and 50.");
    }

    if (jobAnalysis.postingsAnalyzed === 0) {
        throw new Error(
            "Cannot match resume evidence without job-market data."
        );
    }

    // Focus on the most frequently requested skills first.
    const marketSkills = jobAnalysis.skills
        .slice(0, maxSkills)
        .map((skill) => ({
            name: skill.name,
            category: skill.category,
            importance:
                skill.requiredCount > 0 ? "required" : "preferred",
            requiredCount: skill.requiredCount,
            preferredCount: skill.preferredCount,
            demandPercent: skill.demandPercent,
        }));

    const prompt = `
You are an evidence-based resume evaluation specialist.

Compare the candidate's resume evidence against actual
requirements found in job advertisements.

TARGET ROLE:
${jobAnalysis.targetRole}

LOCATION:
${jobAnalysis.location}

JOB POSTING SAMPLE:
${jobAnalysis.postingsAnalyzed} postings analyzed.

MARKET REQUIREMENTS:
${JSON.stringify(marketSkills)}

CANDIDATE RESUME ANALYSIS:
${JSON.stringify(resumeAnalysis)}

For each market skill, classify its resume evidence as:

1. demonstrated:
   The resume contains specific evidence that the candidate
   has used or demonstrated the skill.

2. partially_demonstrated:
   The resume contains related or limited evidence, but it
   does not clearly demonstrate the complete capability.

3. not_evidenced:
   The supplied resume does not contain sufficient evidence.

IMPORTANT:

- Not evidenced does NOT mean the candidate lacks the skill.
- Do not invent experience or assume proficiency.
- A skill listed without a supporting project or experience
  is weaker evidence than a specific example of using it.
- Consider relevant projects, education, employment and
  contributions.
- Do not penalize candidates simply for being students.
- Do not treat years of experience as the only indicator
  of ability.
- Preserve the distinction between required and preferred skills.
- Consider the observed market demand percentage.
- Provide concrete, achievable recommendations.
- Do not recommend adding a skill to the resume unless
  the candidate can substantiate it.

For each skill, provide:
- Its importance.
- Its evidence status.
- Actual resume evidence, where available.
- An explanation of the assessment.
- The next best action.

Also identify:
- The candidate's strongest existing evidence.
- The most important gaps to address.
- Weak or vague resume content.

Prioritize requirements that appear in more advertisements,
especially those marked required.

Return only the structured result.
`;

    const result = await generateJson<
        Omit<EvidenceMatchResult, "targetRole">
    >(env, prompt, MATCH_SCHEMA);

    // We add the target role from our trusted input rather
    // than asking Gemini to determine it again.
    return {
        targetRole: jobAnalysis.targetRole,
        skillAssessments: result.skillAssessments.map((item) => ({
            ...item,
            importance:
                item.importance === "required" ? "required" : "preferred",
            status: [
                "demonstrated",
                "partially_demonstrated",
                "not_evidenced",
            ].includes(item.status)
                ? item.status as SkillEvidenceStatus
                : "not_evidenced",
            demandPercent:
                jobAnalysis.skills.find(
                    (skill) =>
                        skill.name.toLowerCase() === item.skill.toLowerCase()
                )?.demandPercent ?? 0,
        })),
        overallStrengths: result.overallStrengths,
        topPriorities: result.topPriorities,
        resumeContentIssues: result.resumeContentIssues,
    };
}

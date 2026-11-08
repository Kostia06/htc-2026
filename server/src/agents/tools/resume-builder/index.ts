import type { Env } from "../../../env";
import { matchResumeEvidence, type EvidenceMatchResult } from "./evidence-matcher";
import { analyzeJobMarket, type JobAnalysis } from "./job-analyzer";
import { recommendProjects } from "./project-recommender";
import { analyzeResume, type ResumeAnalysis } from "./resume-analyzer";
import { generateTailoredResume, type TailoredResume } from "./resume-generator";

type ProjectRecommendations = Awaited<ReturnType<typeof recommendProjects>>;

export type BuildResumeIntelligenceInput = {
    targetRole: string;
    location: string;
    resumeText: string;
    preferredLanguages?: string[];
    timeBudgetHours?: number;
};

export type ResumeIntelligenceResult = {
    targetRole: string;
    location: string;
    generatedAt: string;
    jobAnalysis: JobAnalysis;
    resumeAnalysis: ResumeAnalysis;
    evidenceMatch: EvidenceMatchResult;
    projectRecommendations: ProjectRecommendations;
    projectRecommendationError?: string;
    tailoredResume: TailoredResume;
};

function emptyProjectRecommendations(
    targetRole: string,
    timeBudgetHours: number,
    searchedSkills: string[] = [],
): ProjectRecommendations {
    return {
        targetRole,
        searchedSkills,
        timeBudgetHours,
        ideas: [],
        inspirationRepositories: [],
        retrievedAt: new Date().toISOString(),
    };
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Project recommendations are temporarily unavailable.";
}

/**
 * Runs the full Resume Intelligence workflow.
 *
 * Job-market and resume analysis are independent, so they run in parallel.
 * Evidence matching uses both results. Project recommendations use the
 * candidate's unproven/partially proven skills, while resume generation is
 * grounded in the original resume and the evidence assessment.
 */
export async function buildResumeIntelligence(
    env: Env,
    input: BuildResumeIntelligenceInput,
): Promise<ResumeIntelligenceResult> {
    const targetRole = input.targetRole?.trim();
    const location = input.location?.trim();
    const resumeText = input.resumeText?.trim();
    const preferredLanguages = Array.from(
        new Set(
            (input.preferredLanguages ?? [])
                .filter((value): value is string => typeof value === "string")
                .map((value) => value.trim())
                .filter(Boolean),
        ),
    ).slice(0, 10);
    const timeBudgetHours = input.timeBudgetHours ?? 25;

    if (!targetRole || targetRole.length > 100) {
        throw new Error("Target role must be between 1 and 100 characters.");
    }
    if (!location || location.length > 100) {
        throw new Error("Location must be between 1 and 100 characters.");
    }
    if (!resumeText || resumeText.length > 30_000) {
        throw new Error("Resume text must be between 1 and 30,000 characters.");
    }
    if (![10, 25, 50, 100].includes(timeBudgetHours)) {
        throw new Error("Project time budget must be 10, 25, 50, or 100 hours.");
    }

    // Stage 1: research employer demand and understand the candidate's resume.
    const [jobAnalysis, resumeAnalysis] = await Promise.all([
        analyzeJobMarket(env, { targetRole, location, maxJobs: 20 }),
        analyzeResume(env, { targetRole, resumeText }),
    ]);

    // Stage 2: compare evidence against the job requirements.
    // If Adzuna returns no matching postings, preserve the resume analysis and
    // still generate a truthful resume draft, while clearly flagging that no
    // market comparison was possible.
    const evidenceMatch: EvidenceMatchResult = jobAnalysis.postingsAnalyzed > 0
        ? await matchResumeEvidence(env, { jobAnalysis, resumeAnalysis, maxSkills: 25 })
        : {
            targetRole,
            skillAssessments: [],
            overallStrengths: [],
            topPriorities: [],
            resumeContentIssues: [
                "No matching job postings were available, so employer requirements could not be compared with this resume.",
            ],
        };

    const missingSkills = evidenceMatch.skillAssessments
        .filter((item) => item.status !== "demonstrated")
        .map((item) => item.skill);

    // Stage 3: look up GitHub examples and create original project ideas.
    // A GitHub/API failure should not prevent the user from receiving the
    // job analysis, evidence assessment, or tailored resume.
    const projectPromise: Promise<{
        recommendations: ProjectRecommendations;
        error?: string;
    }> = missingSkills.length > 0
        ? recommendProjects(env, {
            targetRole,
            missingSkills,
            existingSkills: resumeAnalysis.skills.map((skill) => skill.name),
            preferredLanguages,
            timeBudgetHours,
            maxIdeas: 3,
        })
            .then((recommendations) => ({ recommendations }))
            .catch((error: unknown) => ({
                recommendations: emptyProjectRecommendations(targetRole, timeBudgetHours, missingSkills.slice(0, 4)),
                error: errorMessage(error),
            }))
        : Promise.resolve({
            recommendations: emptyProjectRecommendations(targetRole, timeBudgetHours),
        });

    // Stage 4: generate the job-specific resume using only the original resume
    // and the actual job/evidence analysis. Suggested projects are not added as
    // completed experience; they must be built before appearing on a resume.
    const resumePromise = generateTailoredResume(env, {
        targetRole,
        resumeText,
        resumeAnalysis,
        jobAnalysis,
        evidenceMatch,
    });

    const [projectResult, tailoredResume] = await Promise.all([
        projectPromise,
        resumePromise,
    ]);

    return {
        targetRole,
        location,
        generatedAt: new Date().toISOString(),
        jobAnalysis,
        resumeAnalysis,
        evidenceMatch,
        projectRecommendations: projectResult.recommendations,
        ...(projectResult.error ? { projectRecommendationError: projectResult.error } : {}),
        tailoredResume,
    };
}

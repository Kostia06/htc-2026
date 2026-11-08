// Recommended section order per career stage; lead with whatever proves fit best for that stage.
import type { SectionOrder } from "./types";

export const sectionOrders: SectionOrder[] = [
    {
        stage: "student",
        order: ["Contact", "Summary", "Education", "Projects", "Experience", "Skills", "Volunteering"],
        note: "Education and projects show the most relevant ability while work history is still short.",
    },
    {
        stage: "new_grad",
        order: ["Contact", "Summary", "Education", "Experience", "Projects", "Skills", "Volunteering"],
        note: "The fresh credential leads, with internships, co-ops, and part-time work right behind it.",
    },
    {
        stage: "career_changer",
        order: ["Contact", "Summary", "Skills", "Relevant Projects", "Experience", "Education and Training", "Volunteering"],
        note: "A summary and skills section frame transferable strengths before older, unrelated job titles.",
    },
    {
        stage: "experienced",
        order: ["Contact", "Summary", "Experience", "Skills", "Education", "Certifications"],
        note: "Recent results in the field carry the most weight, so experience comes right after the summary.",
    },
    {
        stage: "returning",
        order: ["Contact", "Summary", "Experience", "Skills", "Training and Development", "Volunteering", "Education"],
        note: "A summary can name the gap briefly, then experience and recent training show skills are current.",
    },
    {
        stage: "apprentice",
        order: ["Contact", "Summary", "Certifications and Tickets", "Experience", "Technical Training", "Skills", "Education"],
        note: "Tickets, apprenticeship level, and logged hours are what trades employers check first.",
    },
    {
        stage: "newcomer",
        order: ["Contact", "Summary", "Skills", "Experience", "Education", "Canadian Credentials and Training", "Languages", "Volunteering"],
        note: "Lead with skills and give context for international roles and credential assessments Canadian employers may not recognise.",
    },
];

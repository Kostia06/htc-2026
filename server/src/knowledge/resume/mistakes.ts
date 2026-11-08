// Common resume mistakes recruiters cite, each with why it costs the applicant.
import type { Rule } from "./types";

export const commonMistakes: Rule[] = [
    { rule: "Listing duties instead of results", why: "Recruiters already know what the job involves; they want to see what you achieved in it." },
    { rule: "Starting bullets with \"Responsible for\" or \"Helped with\"", why: "Weak openers hide your role; a strong action verb shows what you actually did." },
    { rule: "Inventing or inflating numbers", why: "Figures get checked in interviews and reference calls; leave [add number] until you have a real one." },
    { rule: "Going past two pages", why: "Canadian recruiters expect one to two pages and often skim only the first." },
    { rule: "Adding a photo, age, SIN, or marital status", why: "Canadian employers avoid this to reduce bias, and a SIN on a resume risks identity theft." },
    { rule: "Using one generic resume for every application", why: "Tailored resumes match the posting's keywords and show the recruiter you read it." },
    { rule: "Typos and grammar errors", why: "Many recruiters treat errors as a sign of carelessness and stop reading." },
    { rule: "An unprofessional email address", why: "A simple firstname.lastname address looks credible; a joke address undermines the rest." },
    { rule: "Writing a vague objective like \"seeking a challenging role\"", why: "It says nothing specific; a two-line summary of what you offer this role works better." },
    { rule: "Including references or \"references available on request\"", why: "Employers assume you will provide them, so the line wastes space." },
    { rule: "Listing every skill you have ever touched", why: "A long unfocused list buries the skills the posting asks for and invites hard questions." },
    { rule: "Leaving unexplained gaps", why: "A one-line note on caregiving, study, or travel answers the question before it is asked." },
    { rule: "Overly designed templates with columns and graphics", why: "They often break in applicant tracking systems and distract from content." },
    { rule: "Inconsistent dates, fonts, or formatting", why: "Inconsistency reads as rushed and makes the timeline harder to follow." },
    { rule: "Using first person (\"I did\", \"my team\")", why: "Resume convention drops pronouns; starting with the verb keeps bullets tight." },
    { rule: "Burying the most relevant experience", why: "Recruiters skim the top third; put what matches the posting where they look first." },
    { rule: "Using jargon or acronyms only your old employer used", why: "Internal terms mean nothing to a new reader; describe the work in plain, common terms." },
    { rule: "Listing old or irrelevant jobs in full detail", why: "Space is better spent on recent, relevant roles; older ones can be one line or dropped." },
];

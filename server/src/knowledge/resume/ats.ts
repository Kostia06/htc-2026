// What helps and hurts a resume in applicant tracking systems, from widely published recruiter and ATS guidance.
import type { Rule } from "./types";

export const atsDos: Rule[] = [
    { rule: "Submit a .docx or text-based PDF unless the posting asks for something else", why: "Most ATS parse these reliably; scanned or image PDFs often come through blank." },
    { rule: "Use a single-column layout", why: "Parsers read left to right, top to bottom; columns can scramble the order of your content." },
    { rule: "Use standard headings like Experience, Education, Skills, Projects", why: "ATS map content by recognised section names; creative headings can leave sections unread." },
    { rule: "Mirror keywords from the posting where they truly describe your experience", why: "Recruiters search the ATS for posting terms, but claiming skills you lack fails at interview." },
    { rule: "Write the full term and the acronym once, e.g. Search Engine Optimization (SEO)", why: "A recruiter may search either form, so including both catches both." },
    { rule: "Put contact details in the body of the page, not the header or footer", why: "Some ATS skip headers and footers, losing your name, email, or phone." },
    { rule: "Use a consistent date format such as Jan 2024 – Apr 2025", why: "ATS calculate experience from dates; mixed formats can be misread or dropped." },
    { rule: "List job title, employer, city, and dates for each role", why: "These are the fields ATS extract first and recruiters filter on." },
    { rule: "Use common fonts like Arial, Calibri, or Garamond at 10–12 pt", why: "Standard fonts render the same on every system and parse without odd characters." },
    { rule: "Use simple round or square bullet points", why: "Custom symbols can turn into question marks or garbage characters after parsing." },
    { rule: "Name the file clearly, e.g. FirstName-LastName-Resume.pdf", why: "Recruiters download many files; a clear name keeps yours findable." },
    { rule: "Include a skills section listing tools and certifications by name", why: "It gives the ATS and recruiter one place to confirm hard requirements quickly." },
];

export const atsDonts: Rule[] = [
    { rule: "Don't put text inside images, icons, or graphics", why: "ATS cannot read text in images, so that content simply disappears." },
    { rule: "Don't use tables or text boxes for layout", why: "Many parsers skip or jumble content inside tables and text boxes." },
    { rule: "Don't use skill bars, star ratings, or charts", why: "They carry no readable data for an ATS and mean little to a human reviewer." },
    { rule: "Don't stuff keywords or paste the posting in white text", why: "Recruiters see the parsed text, and hidden keyword lists look dishonest." },
    { rule: "Don't use a template built with multiple columns or sidebars", why: "Sidebar content is often read out of order or merged into the wrong section." },
    { rule: "Don't rely on unusual fonts or decorative characters", why: "Unsupported fonts can be substituted or turned into unreadable symbols." },
    { rule: "Don't upload a scanned or photographed resume", why: "It is an image, so the ATS extracts no text at all." },
    { rule: "Don't use only years for dates when months are known", why: "Some ATS read 2023 – 2024 as zero or unclear months, misjudging your experience." },
    { rule: "Don't abbreviate job titles or schools in non-standard ways", why: "Searches for the full name will miss an unusual abbreviation." },
    { rule: "Don't send the same resume to every posting", why: "Keyword match varies by posting; a generic resume ranks lower in ATS searches." },
    { rule: "Don't add a photo, age, SIN, or marital status", why: "Canadian employers avoid this information to reduce bias, and photos can break parsing." },
    { rule: "Don't hide key details in hyperlinks alone", why: "The ATS keeps the link text, not the page behind it, so name what the link shows." },
];

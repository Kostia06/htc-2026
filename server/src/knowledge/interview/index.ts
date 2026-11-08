import { businessCompanyQuestions } from "./companies-business";
import { peopleCompanyQuestions } from "./companies-people";
import { techCompanyQuestions } from "./companies-tech";
import { businessFieldQuestions } from "./fields-business";
import { generalFieldQuestions } from "./fields-general";
import { peopleFieldQuestions } from "./fields-people";
import { techFieldQuestions } from "./fields-tech";
import type { BankQuestion, CompanyQuestionSet, Field } from "./types";

export const companyQuestionSets: CompanyQuestionSet[] = [...techCompanyQuestions, ...businessCompanyQuestions, ...peopleCompanyQuestions];

export const fieldQuestions = { ...techFieldQuestions, ...businessFieldQuestions, ...peopleFieldQuestions, ...generalFieldQuestions } as Record<Field, BankQuestion[]>;

export * from "./types";

import Foundation

/// What the coach made of a finished session: one score, a verdict, and tips each tied to a moment in the conversation.
public struct SessionDebrief: Decodable, Equatable, Sendable {
    public struct Strength: Decodable, Equatable, Sendable {
        /// Their own words.
        public let quote: String
        public let why: String

        public init(quote: String, why: String) {
            self.quote = quote
            self.why = why
        }
    }

    public struct Improvement: Decodable, Equatable, Sendable {
        public let moment: String
        public let said: String
        public let better: String
        public let example: String

        public init(moment: String, said: String, better: String, example: String) {
            self.moment = moment
            self.said = said
            self.better = better
            self.example = example
        }
    }

    public struct QuestionResult: Decodable, Equatable, Sendable {
        public let question: String
        /// 0–100
        public let score: Int
        public let oneLineFeedback: String

        public init(question: String, score: Int, oneLineFeedback: String) {
            self.question = question
            self.score = score
            self.oneLineFeedback = oneLineFeedback
        }
    }

    /// 0–100
    public let overall: Int
    public let verdict: String
    public let strengths: [Strength]
    public let improvements: [Improvement]
    public let perQuestion: [QuestionResult]
    public let nextSteps: [String]

    public init(
        overall: Int, verdict: String, strengths: [Strength], improvements: [Improvement],
        perQuestion: [QuestionResult], nextSteps: [String],
    ) {
        self.overall = overall
        self.verdict = verdict
        self.strengths = strengths
        self.improvements = improvements
        self.perQuestion = perQuestion
        self.nextSteps = nextSteps
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        overall = try container.decode(Int.self, forKey: .overall)
        verdict = try container.decode(String.self, forKey: .verdict)
        strengths = try container.decodeIfPresent([Strength].self, forKey: .strengths) ?? []
        improvements = try container.decodeIfPresent([Improvement].self, forKey: .improvements) ?? []
        perQuestion = try container.decodeIfPresent([QuestionResult].self, forKey: .perQuestion) ?? []
        nextSteps = try container.decodeIfPresent([String].self, forKey: .nextSteps) ?? []
    }

    private enum CodingKeys: String, CodingKey { case overall, verdict, strengths, improvements, perQuestion, nextSteps }
}

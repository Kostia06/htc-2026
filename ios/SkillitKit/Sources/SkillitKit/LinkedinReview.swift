import Foundation

/// The part of a LinkedIn profile a suggestion is about.
public enum LinkedinArea: String, Decodable, Sendable, CaseIterable {
    case headline, about, skills, experience
}

/// Edits for a LinkedIn profile, each pointing at the exact text in the person's own PDF.
public struct LinkedinReview: Decodable, Equatable, Sendable {
    public struct Suggestion: Decodable, Equatable, Sendable, Identifiable {
        public let area: LinkedinArea
        public let quote: String
        public let suggestion: String
        public let why: String
        public var id: String {
            "\(area.rawValue)|\(quote)|\(suggestion)"
        }

        public init(area: LinkedinArea, quote: String, suggestion: String, why: String) {
            self.area = area
            self.quote = quote
            self.suggestion = suggestion
            self.why = why
        }
    }

    public let targetRole: String?
    public let suggestions: [Suggestion]

    public init(targetRole: String?, suggestions: [Suggestion]) {
        self.targetRole = targetRole
        self.suggestions = suggestions
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        targetRole = try container.decodeIfPresent(String.self, forKey: .targetRole)
        // an area this build doesn't know yet is dropped rather than failing the whole review
        let lossy = try container.decodeIfPresent([Lossy<Suggestion>].self, forKey: .suggestions) ?? []
        suggestions = lossy.compactMap(\.value)
    }

    private enum CodingKeys: String, CodingKey { case targetRole, suggestions }
}

private struct Lossy<Value: Decodable>: Decodable {
    let value: Value?

    init(from decoder: Decoder) throws {
        value = try? Value(from: decoder)
    }
}

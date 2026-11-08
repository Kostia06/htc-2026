import Foundation

/// One step of a suggestion path like `experience[0].bullets[1]`.
enum ResumePathSegment: Equatable {
    case key(String)
    case index(Int)

    static func parse(_ path: String) -> [ResumePathSegment] {
        path.split(whereSeparator: { $0 == "." || $0 == "[" }).compactMap { piece in
            if piece.hasSuffix("]") {
                return Int(piece.dropLast()).map(ResumePathSegment.index)
            }
            return piece.isEmpty ? nil : .key(String(piece))
        }
    }
}

/// Which bullet of which entry a path points at.
private struct BulletLocation {
    let section: Resume.Section
    let entry: Int
    let bullet: Int

    init?(_ segments: [ResumePathSegment]) {
        guard segments.count == 4,
              case let .key(name) = segments[0], let section = Resume.Section(rawValue: name),
              case let .index(entry) = segments[1],
              segments[2] == .key("bullets"),
              case let .index(bullet) = segments[3]
        else { return nil }
        self.section = section
        self.entry = entry
        self.bullet = bullet
    }
}

public extension Resume {
    /// The text a suggestion path points at, or nil when the path doesn't lead to a line in this resume.
    func text(at path: String) -> String? {
        let segments = ResumePathSegment.parse(path)
        if segments == [.key("summary")] {
            return summary
        }
        guard let location = BulletLocation(segments) else { return nil }
        return bullets(in: location.section)[safe: location.entry]?[safe: location.bullet]
    }

    /// Puts the suggestion's rewrite where its path points. False when the path no longer leads anywhere.
    @discardableResult
    mutating func apply(_ suggestion: ResumeSuggestion) -> Bool {
        let segments = ResumePathSegment.parse(suggestion.path)
        if segments == [.key("summary")] {
            summary = suggestion.after
            return true
        }
        guard let location = BulletLocation(segments) else { return false }
        switch location.section {
        case .experience:
            guard experience[safe: location.entry]?.bullets[safe: location.bullet] != nil else { return false }
            experience[location.entry].bullets[location.bullet] = suggestion.after
        case .projects:
            guard projects[safe: location.entry]?.bullets[safe: location.bullet] != nil else { return false }
            projects[location.entry].bullets[location.bullet] = suggestion.after
        default:
            return false
        }
        return true
    }

    /// Where a suggestion lands, for labels like "Experience · ATB Financial".
    func label(for path: String) -> String {
        let segments = ResumePathSegment.parse(path)
        if segments == [.key("summary")] {
            return "Summary"
        }
        guard let location = BulletLocation(segments) else { return "Resume" }
        let detail: String? = switch location.section {
        case .experience: experience[safe: location.entry]?.org
        case .projects: projects[safe: location.entry]?.name
        default: nil
        }
        guard let detail, !detail.isEmpty else { return location.section.rawValue.capitalized }
        return "\(location.section.rawValue.capitalized) · \(detail)"
    }

    private func bullets(in section: Section) -> [[String]] {
        switch section {
        case .experience: experience.map(\.bullets)
        case .projects: projects.map(\.bullets)
        default: []
        }
    }
}

extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

import Foundation

/// Any other app from Composio's catalog (Slack, Linear, Figma…), beyond the curated services. These connect but import
/// nothing; Skillit's assistant can only look things up in them, read-only.
public struct ConnectedApp: Decodable, Equatable, Sendable, Identifiable {
    public enum Status: String, Decodable, Sendable {
        case notConnected = "not_connected"
        case pending
        case connected
        case revoking

        public init(from decoder: Decoder) throws {
            let raw = try decoder.singleValueContainer().decode(String.self)
            self = Status(rawValue: raw) ?? .notConnected
        }
    }

    public let slug: String
    public let name: String
    public let logo: URL?
    public let category: String?
    /// false when Composio can't manage this app's sign-in, so there's nothing to tap
    public let connectable: Bool
    /// one of the curated services, which keep their own row above
    public let isCurated: Bool
    public var status: Status

    public var id: String {
        slug
    }

    public var isLinked: Bool {
        status == .connected || status == .revoking
    }

    private enum CodingKeys: String, CodingKey {
        case slug, name, logo, category, connectable, curated, status
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        slug = try container.decode(String.self, forKey: .slug)
        name = try container.decode(String.self, forKey: .name)
        // only an https logo is ever loaded
        let logoURL = try container.decodeIfPresent(String.self, forKey: .logo).flatMap(URL.init(string:))
        logo = logoURL?.scheme == "https" ? logoURL : nil
        category = try container.decodeIfPresent(String.self, forKey: .category)
        connectable = try container.decodeIfPresent(Bool.self, forKey: .connectable) ?? true
        isCurated = try container.decodeIfPresent(Bool.self, forKey: .curated) ?? false
        status = try container.decodeIfPresent(Status.self, forKey: .status) ?? .notConnected
    }

    public init(slug: String, name: String, status: Status = .notConnected, connectable: Bool = true) {
        self.slug = slug
        self.name = name
        logo = nil
        category = nil
        self.connectable = connectable
        isCurated = false
        self.status = status
    }
}

/// One page of catalog matches, and the cursor for the next page when there is one.
public struct AppCatalogPage: Decodable, Equatable, Sendable {
    public let apps: [ConnectedApp]
    public let next: String?

    public init(apps: [ConnectedApp], next: String?) {
        self.apps = apps
        self.next = next
    }
}

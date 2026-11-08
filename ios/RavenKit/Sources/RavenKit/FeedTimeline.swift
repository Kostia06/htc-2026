import Foundation

/// The cards loaded so far and where the next page starts.
public struct FeedTimeline: Codable, Sendable, Equatable {
    public private(set) var cards: [FeedCard]
    public private(set) var nextCursor: String?

    public init(cards: [FeedCard] = [], nextCursor: String? = nil) {
        self.cards = cards
        self.nextCursor = nextCursor
    }

    /// An empty page while the server builds means "nothing new yet", not "nothing at all", so what's shown stays.
    public mutating func apply(firstPage page: FeedPage) {
        guard !(page.items.isEmpty && page.building) else { return }
        cards = page.items
        nextCursor = page.nextCursor
    }

    /// Cursors are offsets, so a rebuild between pages can shift a card onto the next one; it's shown once.
    public mutating func apply(nextPage page: FeedPage) {
        let shown = Set(cards.map(\.id))
        cards += page.items.filter { !shown.contains($0.id) }
        nextCursor = page.nextCursor
    }
}

/// The last feed on disk, so the tab opens on real cards instead of skeletons.
public struct FeedCache: Sendable {
    public static let maxCards = 40
    private let file: URL

    public init(file: URL) {
        self.file = file
    }

    public static var standard: FeedCache {
        FeedCache(file: URL.cachesDirectory.appending(path: "for-you-feed.json"))
    }

    public func load() -> FeedTimeline? {
        guard let data = try? Data(contentsOf: file) else { return nil }
        return try? JSONDecoder().decode(FeedTimeline.self, from: data)
    }

    /// Keeps the first pages only; the cursor then points just past them, so scrolling on carries on from there.
    public func save(_ timeline: FeedTimeline) {
        let kept = timeline.cards.count > Self.maxCards
            ? FeedTimeline(cards: Array(timeline.cards.prefix(Self.maxCards)), nextCursor: "\(Self.maxCards)")
            : timeline
        guard let data = try? JSONEncoder().encode(kept) else { return }
        try? data.write(to: file, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    public func clear() {
        try? FileManager.default.removeItem(at: file)
    }
}

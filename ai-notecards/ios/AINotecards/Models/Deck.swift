import Foundation

struct Deck: Codable, Identifiable {
    let id: String
    let title: String
    let origin: String?
    let sourceText: String?
    let createdAt: Date?
    var cards: [Card]?
    let purchasedFromListingId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, origin, cards
        case sourceText = "source_text"
        case createdAt = "created_at"
        case purchasedFromListingId = "purchased_from_listing_id"
    }

    var cardCount: Int { cards?.count ?? 0 }
    var isPurchased: Bool { origin == "purchased" }
}

struct Card: Codable, Identifiable {
    let id: String?
    let front: String
    let back: String
    let position: Int

    enum CodingKeys: String, CodingKey {
        case id, front, back, position
    }
}

struct GenerateResponse: Codable {
    let deck: Deck
    let generationsRemaining: Int?
}

struct DecksResponse: Codable {
    let decks: [Deck]
}

struct DeckResponse: Codable {
    let deck: Deck
}

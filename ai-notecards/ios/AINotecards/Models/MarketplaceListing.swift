import Foundation

struct MarketplaceListing: Codable, Identifiable {
    let id: String
    let title: String
    let description: String?
    let priceCents: Int
    let purchaseCount: Int?
    let averageRating: Double?
    let ratingCount: Int?
    let createdAt: Date?
    let categoryName: String?
    let categorySlug: String?
    let sellerName: String?
    let sellerStudyScore: Int?
    let cardCount: Int?
    let tags: [String]?
    let status: String?
    let deckId: String?
    let sellerId: String?

    enum CodingKeys: String, CodingKey {
        case id, title, description, tags, status
        case priceCents = "price_cents"
        case purchaseCount = "purchase_count"
        case averageRating = "average_rating"
        case ratingCount = "rating_count"
        case createdAt = "created_at"
        case categoryName = "category_name"
        case categorySlug = "category_slug"
        case sellerName = "seller_name"
        case sellerStudyScore = "seller_study_score"
        case cardCount = "card_count"
        case deckId = "deck_id"
        case sellerId = "seller_id"
    }

    var priceFormatted: String {
        let dollars = Double(priceCents) / 100
        return String(format: "$%.2f", dollars)
    }

    var ratingFormatted: String {
        guard let rating = averageRating, rating > 0 else { return "No ratings" }
        return String(format: "%.1f", rating)
    }
}

struct MarketplaceCategory: Codable, Identifiable {
    let id: String
    let name: String
    let slug: String
    let listingCount: Int?

    enum CodingKeys: String, CodingKey {
        case id, name, slug
        case listingCount = "listing_count"
    }
}

struct MarketplaceResponse: Codable {
    let listings: [MarketplaceListing]
    let nextCursor: String?
    let hasMore: Bool
}

struct CategoriesResponse: Codable {
    let categories: [MarketplaceCategory]
}

struct ListingDetailResponse: Codable {
    let listing: MarketplaceListing
    let totalCards: Int
    let sampleCards: [Card]
    let previewCount: Int
}

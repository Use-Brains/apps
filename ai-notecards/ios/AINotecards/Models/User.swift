import Foundation

struct User: Codable, Identifiable {
    let id: String
    let email: String
    let plan: String
    let trialEndsAt: Date?
    let studyScore: Int
    let dailyGenerationCount: Int
    let lastGenerationDate: String?
    let stripeCustomerId: String?
    let stripeConnectAccountId: String?
    let connectChargesEnabled: Bool?
    let displayName: String?
    let role: String?
    let suspended: Bool?
    let createdAt: Date?
    let preferredModel: String?
    let appleSubscriptionExpiresAt: Date?
    let appleSubscriptionProductId: String?

    enum CodingKeys: String, CodingKey {
        case id, email, plan, suspended, role
        case trialEndsAt = "trial_ends_at"
        case studyScore = "study_score"
        case dailyGenerationCount = "daily_generation_count"
        case lastGenerationDate = "last_generation_date"
        case stripeCustomerId = "stripe_customer_id"
        case stripeConnectAccountId = "stripe_connect_account_id"
        case connectChargesEnabled = "connect_charges_enabled"
        case displayName = "display_name"
        case createdAt = "created_at"
        case preferredModel = "preferred_model"
        case appleSubscriptionExpiresAt = "apple_subscription_expires_at"
        case appleSubscriptionProductId = "apple_subscription_product_id"
    }

    var isPro: Bool { plan == "pro" || plan == "byok_pro" }
    var isByokPro: Bool { plan == "byok_pro" }
    var isFree: Bool { plan == "free" }
    var isTrial: Bool { plan == "trial" }

    var trialExpired: Bool {
        guard isTrial, let ends = trialEndsAt else { return false }
        return ends < Date()
    }
}

struct AuthResponse: Codable {
    let token: String
    let user: User
}

struct UserResponse: Codable {
    let user: User?
}

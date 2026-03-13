import Foundation

enum Constants {
    // MARK: - API
    #if DEBUG
    static let apiBaseURL = "http://localhost:3001"
    #else
    static let apiBaseURL = "https://api.ainotecards.com"
    #endif

    static let defaultTimeout: TimeInterval = 30
    static let generateTimeout: TimeInterval = 120

    // MARK: - StoreKit Product IDs
    enum Products {
        static let proMonthly = "com.ainotecards.pro.monthly"
        static let byokProMonthly = "com.ainotecards.byokpro.monthly"

        static let subscriptionIDs: Set<String> = [proMonthly, byokProMonthly]

        // Consumable tiers for marketplace purchases
        static let deckTier1 = "com.ainotecards.deck.tier1"   // $1
        static let deckTier2 = "com.ainotecards.deck.tier2"   // $2
        static let deckTier3 = "com.ainotecards.deck.tier3"   // $3
        static let deckTier4 = "com.ainotecards.deck.tier4"   // $4
        static let deckTier5 = "com.ainotecards.deck.tier5"   // $5

        static let consumableIDs: Set<String> = [
            deckTier1, deckTier2, deckTier3, deckTier4, deckTier5
        ]

        static let allIDs: Set<String> = subscriptionIDs.union(consumableIDs)

        /// Map price_cents from listing to consumable product ID
        static func consumableProductID(forPriceCents cents: Int) -> String? {
            switch cents {
            case 100: return deckTier1
            case 200: return deckTier2
            case 300: return deckTier3
            case 400: return deckTier4
            case 500: return deckTier5
            default: return nil
            }
        }
    }

    // MARK: - Keychain
    enum Keychain {
        static let service = "com.ainotecards.keychain"
        static let tokenKey = "jwt_token"
        static let apiKeyKey = "openrouter_api_key"
    }

    // MARK: - URL Scheme
    static let urlScheme = "ainotecards"

    // MARK: - BYOK Models (hardcoded curated list)
    struct AIModel: Identifiable, Hashable {
        let id: String
        let name: String
        let provider: String
    }

    static let byokModels: [AIModel] = [
        AIModel(id: "anthropic/claude-sonnet-4-5", name: "Claude Sonnet 4.5", provider: "Anthropic"),
        AIModel(id: "anthropic/claude-haiku-4-5", name: "Claude Haiku 4.5", provider: "Anthropic"),
        AIModel(id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI"),
        AIModel(id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI"),
        AIModel(id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", provider: "Google"),
        AIModel(id: "google/gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "Google"),
        AIModel(id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta"),
        AIModel(id: "deepseek/deepseek-chat-v3", name: "DeepSeek V3", provider: "DeepSeek"),
        AIModel(id: "mistralai/mistral-large", name: "Mistral Large", provider: "Mistral"),
        AIModel(id: "qwen/qwen-2.5-72b-instruct", name: "Qwen 2.5 72B", provider: "Qwen"),
    ]

    // MARK: - Limits
    static let maxInputCharsFree = 30_000
    static let maxInputCharsByok = 200_000
    static let minInputChars = 10
}

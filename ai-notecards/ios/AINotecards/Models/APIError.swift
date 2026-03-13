import Foundation

/// Mirrors server/src/constants/errors.js
enum APIErrorCode: String, Codable {
    case authRequired = "auth_required"
    case authInvalidToken = "auth_invalid_token"
    case authExpiredToken = "auth_expired_token"
    case authAccountSuspended = "auth_account_suspended"
    case authAccountDeleted = "auth_account_deleted"
    case authInvalidCredentials = "auth_invalid_credentials"
    case authEmailExists = "auth_email_exists"
    case authUseApple = "auth_use_apple"
    case upgradeRequired = "upgrade_required"
    case generationLimitReached = "generation_limit_reached"
    case deckLimitReached = "deck_limit_reached"
    case byokKeyRequired = "byok_key_required"
    case byokKeyInvalid = "byok_key_invalid"
    case byokInsufficientCredits = "byok_insufficient_credits"
    case byokRateLimited = "byok_rate_limited"
    case byokProviderDown = "byok_provider_down"
    case iapVerificationFailed = "iap_verification_failed"
    case iapAccountMismatch = "iap_account_mismatch"
    case iapPriceMismatch = "iap_price_mismatch"
    case iapAlreadyPurchased = "iap_already_purchased"
    case iapSelfPurchase = "iap_self_purchase"
    case iapListingUnavailable = "iap_listing_unavailable"
    case listingNotFound = "listing_not_found"
    case listingPriceChanged = "listing_price_changed"
    case aiGenerationFailed = "ai_generation_failed"
    case aiParseFailed = "ai_parse_failed"
    case inputTooLong = "input_too_long"
    case validationError = "validation_error"
    case notFound = "not_found"
    case serverError = "server_error"
}

struct APIErrorResponse: Codable {
    let error: String
    let message: String?
}

enum APIError: LocalizedError {
    case network(URLError)
    case unauthorized
    case forbidden(String?)
    case notFound
    case conflict(String?)
    case serverError(APIErrorCode?, String?)
    case decodingError(Error)
    case unknown(Int, String?)

    var errorDescription: String? {
        switch self {
        case .network(let error):
            if error.code == .notConnectedToInternet {
                return "No internet connection. Please check your network and try again."
            }
            return "Network error. Please try again."
        case .unauthorized:
            return "Session expired. Please sign in again."
        case .forbidden(let msg):
            return msg ?? "You don't have permission to do that."
        case .notFound:
            return "Not found."
        case .conflict(let msg):
            return msg ?? "This action conflicts with existing data."
        case .serverError(let code, let msg):
            if let code {
                return userFacingMessage(for: code) ?? msg ?? "Something went wrong."
            }
            return msg ?? "Something went wrong."
        case .decodingError:
            return "Unexpected server response."
        case .unknown(_, let msg):
            return msg ?? "Something went wrong."
        }
    }

    var errorCode: APIErrorCode? {
        if case .serverError(let code, _) = self { return code }
        return nil
    }

    private func userFacingMessage(for code: APIErrorCode) -> String? {
        switch code {
        case .generationLimitReached: return "You've reached your daily generation limit. Upgrade to Pro for more."
        case .byokKeyRequired: return "Please add your OpenRouter API key in Settings."
        case .byokKeyInvalid: return "Your API key is invalid or expired. Update it in Settings."
        case .byokInsufficientCredits: return "Your OpenRouter account has insufficient credits."
        case .byokRateLimited: return "Too many requests. Please wait a moment."
        case .aiGenerationFailed: return "AI generation failed. Please try again."
        case .inputTooLong: return "Your input is too long. Please shorten it."
        case .iapSelfPurchase: return "You can't purchase your own deck."
        case .iapAlreadyPurchased: return "You already own this deck."
        case .iapPriceMismatch: return "The listing price has changed. Please refresh and try again."
        default: return nil
        }
    }
}

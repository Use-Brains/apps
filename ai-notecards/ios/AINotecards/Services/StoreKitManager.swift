import StoreKit
import Foundation

@Observable
final class StoreKitManager {
    var subscriptionProducts: [Product] = []
    var consumableProducts: [Product] = []
    var currentSubscription: Product?
    var isPurchasing = false
    var purchaseError: String?

    private var transactionListener: Task<Void, Never>?

    init() {
        // Start transaction listener
        transactionListener = Task.detached { [weak self] in
            await self?.listenForTransactions()
        }
    }

    deinit {
        transactionListener?.cancel()
    }

    // MARK: - Load Products

    func loadProducts() async {
        do {
            let products = try await Product.products(for: Constants.Products.allIDs)
            subscriptionProducts = products
                .filter { Constants.Products.subscriptionIDs.contains($0.id) }
                .sorted { $0.price > $1.price } // Pro first (higher price)

            consumableProducts = products
                .filter { Constants.Products.consumableIDs.contains($0.id) }
                .sorted { $0.price < $1.price }
        } catch {
            print("Failed to load products: \(error)")
        }
    }

    // MARK: - Check Entitlements

    func checkEntitlements() async {
        currentSubscription = nil

        for await result in Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }

            if Constants.Products.subscriptionIDs.contains(transaction.productID) {
                // Find the matching product
                currentSubscription = subscriptionProducts.first { $0.id == transaction.productID }
            }
        }
    }

    // MARK: - Purchase Subscription

    @MainActor
    func purchaseSubscription(_ product: Product, userUUID: String) async throws {
        isPurchasing = true
        purchaseError = nil
        defer { isPurchasing = false }

        guard let uuid = UUID(uuidString: userUUID) else {
            purchaseError = "Invalid user ID"
            throw StoreKitError.userNotAuthenticated
        }

        let result = try await product.purchase(options: [
            .appAccountToken(uuid)
        ])

        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                purchaseError = "Transaction verification failed"
                return
            }

            // Send to backend for verification
            try await verifySubscription(transaction: transaction)
            await transaction.finish()

        case .pending:
            purchaseError = "Purchase is pending approval."
        case .userCancelled:
            break
        @unknown default:
            break
        }
    }

    // MARK: - Purchase Consumable (Marketplace)

    @MainActor
    func purchaseConsumable(
        productID: String,
        listingId: String,
        priceCents: Int,
        userUUID: String
    ) async throws -> String? {
        isPurchasing = true
        purchaseError = nil
        defer { isPurchasing = false }

        guard let product = consumableProducts.first(where: { $0.id == productID }) else {
            purchaseError = "Product not available"
            return nil
        }

        guard let uuid = UUID(uuidString: userUUID) else {
            purchaseError = "Invalid user ID"
            return nil
        }

        // Persist intent for crash recovery
        UserDefaults.standard.set(
            ["listingId": listingId, "priceCents": priceCents],
            forKey: "pendingPurchase_\(productID)"
        )

        let result = try await product.purchase(options: [
            .appAccountToken(uuid)
        ])

        switch result {
        case .success(let verification):
            guard case .verified(let transaction) = verification else {
                purchaseError = "Transaction verification failed"
                return nil
            }

            // Send to backend for verification + fulfillment
            let deckId = try await verifyConsumablePurchase(
                transaction: transaction,
                listingId: listingId,
                priceCents: priceCents
            )

            await transaction.finish()

            // Clear pending purchase
            UserDefaults.standard.removeObject(forKey: "pendingPurchase_\(productID)")

            return deckId

        case .pending:
            purchaseError = "Purchase is pending approval."
            return nil
        case .userCancelled:
            UserDefaults.standard.removeObject(forKey: "pendingPurchase_\(productID)")
            return nil
        @unknown default:
            return nil
        }
    }

    // MARK: - Restore Purchases

    func restorePurchases() async {
        try? await AppStore.sync()
        await checkEntitlements()
    }

    // MARK: - Backend Verification

    private func verifySubscription(transaction: Transaction) async throws {
        struct VerifyBody: Encodable { let signedTransaction: String }

        guard let jwsRepresentation = transaction.jwsRepresentation as? String else {
            return
        }

        struct UserResp: Decodable { let user: User }
        let _: UserResp = try await APIClient.shared.post(
            "/api/iap/verify",
            body: VerifyBody(signedTransaction: jwsRepresentation)
        )
    }

    private func verifyConsumablePurchase(
        transaction: Transaction,
        listingId: String,
        priceCents: Int
    ) async throws -> String? {
        struct VerifyBody: Encodable {
            let signedTransaction: String
            let listingId: String
            let expectedPriceCents: Int
        }

        guard let jwsRepresentation = transaction.jwsRepresentation as? String else {
            return nil
        }

        struct PurchaseResp: Decodable { let ok: Bool; let deckId: String? }
        let response: PurchaseResp = try await APIClient.shared.post(
            "/api/iap/verify-purchase",
            body: VerifyBody(
                signedTransaction: jwsRepresentation,
                listingId: listingId,
                expectedPriceCents: priceCents
            )
        )
        return response.deckId
    }

    // MARK: - Transaction Listener

    private func listenForTransactions() async {
        for await result in Transaction.updates {
            guard case .verified(let transaction) = result else { continue }

            if Constants.Products.subscriptionIDs.contains(transaction.productID) {
                try? await verifySubscription(transaction: transaction)
                await transaction.finish()
                await checkEntitlements()
            } else if Constants.Products.consumableIDs.contains(transaction.productID) {
                // Attempt crash recovery using UserDefaults
                let key = "pendingPurchase_\(transaction.productID)"
                if let pendingData = UserDefaults.standard.dictionary(forKey: key),
                   let listingId = pendingData["listingId"] as? String,
                   let priceCents = pendingData["priceCents"] as? Int {
                    _ = try? await verifyConsumablePurchase(
                        transaction: transaction,
                        listingId: listingId,
                        priceCents: priceCents
                    )
                    UserDefaults.standard.removeObject(forKey: key)
                }
                await transaction.finish()
            }
        }
    }
}

enum StoreKitError: LocalizedError {
    case userNotAuthenticated

    var errorDescription: String? {
        switch self {
        case .userNotAuthenticated: return "Please sign in first."
        }
    }
}

import StoreKit
import SwiftUI

struct SubscriptionView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(StoreKitManager.self) private var storeKitManager
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            if let user = authManager.currentUser, user.isPro {
                // Already subscribed
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.green)

                    Text("You're subscribed to \(planName(user.plan))")
                        .font(.title3.bold())

                    if let expires = user.appleSubscriptionExpiresAt {
                        Text("Renews \(expires.formatted(date: .abbreviated, time: .omitted))")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Button("Manage in Settings") {
                        if let url = URL(string: "https://apps.apple.com/account/subscriptions") {
                            UIApplication.shared.open(url)
                        }
                    }
                    .padding(.top)
                }
            } else {
                // Show subscription options
                SubscriptionStoreView(
                    productIDs: Array(Constants.Products.subscriptionIDs)
                )
                .subscriptionStorePickerItemBackground(.thinMaterial)
            }

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
        }
        .navigationTitle("Subscription")
    }

    private func planName(_ plan: String) -> String {
        switch plan {
        case "pro": return "Pro ($9/mo)"
        case "byok_pro": return "BYOK Pro ($5/mo)"
        default: return plan
        }
    }
}

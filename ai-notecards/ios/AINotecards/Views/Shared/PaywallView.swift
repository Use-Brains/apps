import StoreKit
import SwiftUI

struct PaywallView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(StoreKitManager.self) private var storeKitManager
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                // Marketing content
                VStack(spacing: 12) {
                    Image(systemName: "sparkles")
                        .font(.system(size: 48))
                        .foregroundStyle(.tint)

                    Text("Upgrade to Pro")
                        .font(.title.bold())

                    VStack(alignment: .leading, spacing: 8) {
                        FeatureRow(icon: "infinity", text: "10 generations per day")
                        FeatureRow(icon: "rectangle.stack.fill", text: "Unlimited decks")
                        FeatureRow(icon: "storefront.fill", text: "Sell on the marketplace")
                    }
                    .padding()
                }

                Spacer()

                // StoreKit subscription view
                SubscriptionStoreView(
                    productIDs: Array(Constants.Products.subscriptionIDs)
                )
                .subscriptionStorePickerItemBackground(.thinMaterial)
                .frame(maxHeight: 300)

                Button("Not Now") { dismiss() }
                    .foregroundStyle(.secondary)
            }
            .padding()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

struct FeatureRow: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .frame(width: 24)
                .foregroundStyle(.tint)
            Text(text)
        }
    }
}

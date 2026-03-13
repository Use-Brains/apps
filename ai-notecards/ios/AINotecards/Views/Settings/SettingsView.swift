import SwiftUI

struct SettingsView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(StoreKitManager.self) private var storeKitManager
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false

    var body: some View {
        List {
            // Profile
            if let user = authManager.currentUser {
                Section("Account") {
                    LabeledContent("Email", value: user.email)
                    if let name = user.displayName {
                        LabeledContent("Display Name", value: name)
                    }
                    LabeledContent("Plan") {
                        Text(planDisplayName(user.plan))
                            .foregroundStyle(user.isPro ? .accent : .secondary)
                    }
                    LabeledContent("Study Score", value: "\(user.studyScore)")
                }
            }

            // Subscription
            Section("Subscription") {
                NavigationLink("Manage Subscription") {
                    SubscriptionView()
                }
            }

            // BYOK
            if authManager.currentUser?.isByokPro == true {
                Section("BYOK (Bring Your Own Key)") {
                    NavigationLink("API Key & Model Settings") {
                        BYOKSettingsView()
                    }
                }
            } else {
                Section("BYOK (Bring Your Own Key)") {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Use your own AI model")
                            .font(.headline)
                        Text("Subscribe to BYOK Pro ($5/mo) to use your own OpenRouter API key with any AI model.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Seller
            if authManager.currentUser?.isPro == true {
                Section("Selling") {
                    NavigationLink("Seller Dashboard") {
                        SellerDashboardView()
                    }
                }
            }

            // Actions
            Section {
                Button("Restore Purchases") {
                    Task { await storeKitManager.restorePurchases() }
                }

                Button("Sign Out") {
                    Task { await authManager.logout() }
                }
                .foregroundStyle(.red)
            }

            // Danger zone
            Section {
                Button("Delete Account", role: .destructive) {
                    showDeleteConfirm = true
                }
                .disabled(isDeleting)
            } footer: {
                Text("Deleting your account removes your data permanently. Active Apple subscriptions must be cancelled separately in Settings > Apple ID.")
            }
        }
        .navigationTitle("Settings")
        .confirmationDialog("Delete Account?", isPresented: $showDeleteConfirm) {
            Button("Delete Account", role: .destructive) {
                Task { await deleteAccount() }
            }
        } message: {
            Text("This action cannot be undone. Your decks, study history, and listings will be permanently removed. If you have an active Apple subscription, please cancel it in Settings > Apple ID first.")
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        do {
            try await authManager.deleteAccount()
        } catch {
            // Show error
        }
        isDeleting = false
    }

    private func planDisplayName(_ plan: String) -> String {
        switch plan {
        case "pro": return "Pro"
        case "byok_pro": return "BYOK Pro"
        case "trial": return "Trial"
        default: return "Free"
        }
    }
}

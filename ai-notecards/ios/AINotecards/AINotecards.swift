import SwiftUI

@main
struct AINotecards: App {
    @State private var authManager = AuthManager()
    @State private var storeKitManager = StoreKitManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isAuthenticated {
                    HomeView()
                } else {
                    LoginView()
                }
            }
            .environment(authManager)
            .environment(storeKitManager)
            .task {
                await storeKitManager.loadProducts()
                await storeKitManager.checkEntitlements()
            }
            .onOpenURL { url in
                handleURL(url)
            }
        }
    }

    private func handleURL(_ url: URL) {
        // Handle custom URL scheme callbacks
        guard url.scheme == Constants.urlScheme else { return }

        switch url.host {
        case "stripe-connect":
            // Stripe Connect onboarding return — refresh user data
            Task { await authManager.refreshUser() }
        default:
            break
        }
    }
}

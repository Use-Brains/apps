import AuthenticationServices
import SwiftUI

struct SellerDashboardView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var listings: [MarketplaceListing] = []
    @State private var earnings: SellerEarnings?
    @State private var listingStats: SellerListingStats?
    @State private var isLoading = true
    @State private var connectURL: String?

    private var isConnected: Bool {
        authManager.currentUser?.connectChargesEnabled == true
    }

    var body: some View {
        List {
            if !isConnected {
                Section {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Stripe Connect Required", systemImage: "creditcard")
                            .font(.headline)
                        Text("Complete Stripe onboarding to start selling decks on the marketplace.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Button("Start Onboarding") {
                            Task { await startOnboarding() }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(.vertical, 4)
                }
            }

            if let earnings, let stats = listingStats {
                Section("Earnings") {
                    HStack {
                        Text("Total Earnings")
                        Spacer()
                        Text("$\(String(format: "%.2f", Double(earnings.totalEarningsCents) / 100))")
                            .font(.headline)
                    }
                    HStack {
                        Text("Last 30 Days")
                        Spacer()
                        Text("$\(String(format: "%.2f", Double(earnings.last30EarningsCents) / 100))")
                    }
                    HStack {
                        Text("Total Sales")
                        Spacer()
                        Text("\(earnings.totalSales)")
                    }
                    HStack {
                        Text("Active Listings")
                        Spacer()
                        Text("\(stats.activeListings) / \(stats.totalListings)")
                    }
                }
            }

            Section("Your Listings") {
                if listings.isEmpty && !isLoading {
                    ContentUnavailableView(
                        "No Listings",
                        systemImage: "storefront",
                        description: Text("List a deck from your dashboard to start selling.")
                    )
                } else {
                    ForEach(listings) { listing in
                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(listing.title)
                                    .font(.headline)
                                Spacer()
                                Text(listing.status ?? "")
                                    .font(.caption)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(listing.status == "active" ? Color.green.opacity(0.2) : Color.gray.opacity(0.2))
                                    .clipShape(Capsule())
                            }
                            HStack(spacing: 12) {
                                Text(listing.priceFormatted)
                                if let count = listing.purchaseCount {
                                    Text("\(count) sold")
                                }
                            }
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .navigationTitle("Seller Dashboard")
        .refreshable { await loadData() }
        .task { await loadData() }
    }

    private func loadData() async {
        isLoading = true

        async let dashResp: DashboardResponse? = {
            try? await APIClient.shared.get("/api/seller/dashboard")
        }()
        async let listingsResp: SellerListingsResponse? = {
            try? await APIClient.shared.get("/api/seller/listings")
        }()

        let (dash, list) = await (dashResp, listingsResp)
        earnings = dash?.earnings
        listingStats = dash?.listings
        listings = list?.listings ?? []
        isLoading = false
    }

    private func startOnboarding() async {
        struct Resp: Decodable { let url: String }
        guard let resp: Resp = try? await APIClient.shared.post("/api/seller/onboard") else { return }

        // Use ASWebAuthenticationSession for Stripe Connect
        guard let url = URL(string: resp.url) else { return }

        await MainActor.run {
            let session = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: Constants.urlScheme
            ) { callbackURL, error in
                guard error == nil else { return }
                // Stripe redirects to ainotecards://stripe-connect/return
                Task { await authManager.refreshUser() }
            }
            session.prefersEphemeralWebBrowserSession = false
            session.start()
        }
    }
}

struct SellerEarnings: Codable {
    let totalEarningsCents: Int
    let totalGrossCents: Int
    let totalSales: Int
    let last30EarningsCents: Int

    enum CodingKeys: String, CodingKey {
        case totalEarningsCents = "total_earnings_cents"
        case totalGrossCents = "total_gross_cents"
        case totalSales = "total_sales"
        case last30EarningsCents = "last_30_earnings_cents"
    }
}

struct SellerListingStats: Codable {
    let activeListings: Int
    let totalListings: Int
    let avgRating: Double

    enum CodingKeys: String, CodingKey {
        case activeListings = "active_listings"
        case totalListings = "total_listings"
        case avgRating = "avg_rating"
    }
}

struct DashboardResponse: Codable {
    let earnings: SellerEarnings
    let listings: SellerListingStats
}

struct SellerListingsResponse: Codable {
    let listings: [MarketplaceListing]
}

import SwiftUI

struct ListingDetailView: View {
    let listingId: String

    @Environment(AuthManager.self) private var authManager
    @Environment(StoreKitManager.self) private var storeKitManager
    @State private var listing: MarketplaceListing?
    @State private var sampleCards: [Card] = []
    @State private var totalCards = 0
    @State private var isLoading = true
    @State private var isPurchasing = false
    @State private var purchasedDeckId: String?
    @State private var errorMessage: String?
    @State private var showFlagSheet = false

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let listing {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        // Header
                        VStack(alignment: .leading, spacing: 8) {
                            Text(listing.title)
                                .font(.title2.bold())

                            HStack(spacing: 16) {
                                Label("\(totalCards) cards", systemImage: "rectangle.stack")
                                if let rating = listing.averageRating, rating > 0 {
                                    Label(listing.ratingFormatted, systemImage: "star.fill")
                                        .foregroundStyle(.yellow)
                                }
                                if let count = listing.purchaseCount {
                                    Label("\(count) sold", systemImage: "bag")
                                }
                            }
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                            if let name = listing.sellerName {
                                Text("by \(name)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            if let desc = listing.description {
                                Text(desc)
                                    .font(.body)
                                    .padding(.top, 4)
                            }
                        }
                        .padding(.horizontal)

                        // Tags
                        if let tags = listing.tags, !tags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(tags, id: \.self) { tag in
                                        Text(tag)
                                            .font(.caption)
                                            .padding(.horizontal, 8)
                                            .padding(.vertical, 4)
                                            .background(Color(.systemGray6))
                                            .clipShape(Capsule())
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }

                        // Sample cards
                        Section {
                            ForEach(sampleCards) { card in
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(card.front)
                                        .font(.headline)
                                    Text(card.back)
                                        .font(.subheadline)
                                        .foregroundStyle(.secondary)
                                }
                                .padding()
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color(.systemGray6))
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }
                        } header: {
                            Text("Preview Cards")
                                .font(.headline)
                        }
                        .padding(.horizontal)

                        // Error
                        if let error = errorMessage {
                            Text(error)
                                .font(.caption)
                                .foregroundStyle(.red)
                                .padding(.horizontal)
                        }

                        // Purchase button
                        Button {
                            Task { await purchase() }
                        } label: {
                            if isPurchasing {
                                ProgressView()
                                    .frame(maxWidth: .infinity)
                            } else {
                                Text("Purchase for \(listing.priceFormatted)")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isPurchasing)
                        .padding(.horizontal)
                    }
                    .padding(.vertical)
                }
            } else {
                ContentUnavailableView("Listing Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showFlagSheet = true
                } label: {
                    Image(systemName: "flag")
                }
            }
        }
        .task { await loadListing() }
        .navigationDestination(item: $purchasedDeckId) { deckId in
            DeckDetailView(deckId: deckId)
        }
        .confirmationDialog("Report Listing", isPresented: $showFlagSheet) {
            ForEach(["Inappropriate", "Misleading", "Spam", "Low Quality", "Other"], id: \.self) { reason in
                Button(reason) {
                    Task { await flag(reason: reason) }
                }
            }
        }
    }

    private func loadListing() async {
        do {
            let response: ListingDetailResponse = try await APIClient.shared.get("/api/marketplace/\(listingId)")
            listing = response.listing
            sampleCards = response.sampleCards
            totalCards = response.totalCards
        } catch {
            listing = nil
        }
        isLoading = false
    }

    private func purchase() async {
        guard let listing, let userId = authManager.currentUser?.id else { return }
        isPurchasing = true
        errorMessage = nil

        guard let productID = Constants.Products.consumableProductID(forPriceCents: listing.priceCents) else {
            errorMessage = "This price tier is not available for in-app purchase."
            isPurchasing = false
            return
        }

        do {
            let deckId = try await storeKitManager.purchaseConsumable(
                productID: productID,
                listingId: listing.id,
                priceCents: listing.priceCents,
                userUUID: userId
            )
            if let deckId {
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
                purchasedDeckId = deckId
            }
        } catch {
            errorMessage = storeKitManager.purchaseError ?? "Purchase failed."
        }

        isPurchasing = false
    }

    private func flag(reason: String) async {
        struct Body: Encodable { let reason: String }
        struct Resp: Decodable { let ok: Bool }
        _ = try? await APIClient.shared.post(
            "/api/marketplace/\(listingId)/flag",
            body: Body(reason: reason)
        ) as Resp
    }
}

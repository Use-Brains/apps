import SwiftUI

struct MarketplaceView: View {
    @State private var listings: [MarketplaceListing] = []
    @State private var categories: [MarketplaceCategory] = []
    @State private var selectedCategory: String?
    @State private var searchText = ""
    @State private var sortBy = "popular"
    @State private var nextCursor: String?
    @State private var hasMore = false
    @State private var isLoading = true

    var body: some View {
        VStack(spacing: 0) {
            // Category chips
            if !categories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        CategoryChip(name: "All", isSelected: selectedCategory == nil) {
                            selectedCategory = nil
                            Task { await loadListings(reset: true) }
                        }
                        ForEach(categories) { cat in
                            CategoryChip(
                                name: cat.name,
                                count: cat.listingCount,
                                isSelected: selectedCategory == cat.slug
                            ) {
                                selectedCategory = cat.slug
                                Task { await loadListings(reset: true) }
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 8)
                }
            }

            List {
                ForEach(listings) { listing in
                    NavigationLink(value: listing.id) {
                        ListingRow(listing: listing)
                    }
                }

                if hasMore {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .task { await loadMore() }
                }
            }
            .listStyle(.plain)
        }
        .navigationTitle("Marketplace")
        .navigationDestination(for: String.self) { listingId in
            ListingDetailView(listingId: listingId)
        }
        .searchable(text: $searchText, prompt: "Search decks")
        .onSubmit(of: .search) {
            Task { await loadListings(reset: true) }
        }
        .refreshable { await loadListings(reset: true) }
        .task {
            await loadCategories()
            await loadListings(reset: true)
        }
    }

    private func loadCategories() async {
        let response: CategoriesResponse? = try? await APIClient.shared.get("/api/marketplace/categories")
        categories = response?.categories ?? []
    }

    private func loadListings(reset: Bool) async {
        if reset {
            nextCursor = nil
            listings = []
        }
        isLoading = true

        var path = "/api/marketplace?sort=\(sortBy)&limit=20"
        if let category = selectedCategory { path += "&category=\(category)" }
        if !searchText.isEmpty { path += "&q=\(searchText.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")" }
        if let cursor = nextCursor { path += "&cursor=\(cursor)" }

        if let response: MarketplaceResponse = try? await APIClient.shared.get(path) {
            if reset {
                listings = response.listings
            } else {
                listings.append(contentsOf: response.listings)
            }
            nextCursor = response.nextCursor
            hasMore = response.hasMore
        }
        isLoading = false
    }

    private func loadMore() async {
        guard hasMore else { return }
        await loadListings(reset: false)
    }
}

struct ListingRow: View {
    let listing: MarketplaceListing

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(listing.title)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(listing.priceFormatted)
                    .font(.subheadline.bold())
                    .foregroundStyle(.accent)
            }

            HStack(spacing: 12) {
                if let count = listing.cardCount {
                    Label("\(count) cards", systemImage: "rectangle.stack")
                }
                if let rating = listing.averageRating, rating > 0 {
                    Label(listing.ratingFormatted, systemImage: "star.fill")
                        .foregroundStyle(.yellow)
                }
                if let name = listing.sellerName {
                    Text("by \(name)")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

struct CategoryChip: View {
    let name: String
    var count: Int? = nil
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(name)
                if let count { Text("(\(count))").foregroundStyle(.secondary) }
            }
            .font(.subheadline)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(isSelected ? Color.accentColor : Color(.systemGray6))
            .foregroundStyle(isSelected ? .white : .primary)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

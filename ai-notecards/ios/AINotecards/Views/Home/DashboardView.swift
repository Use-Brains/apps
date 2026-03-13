import SwiftUI

struct DashboardView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var decks: [Deck] = []
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        List {
            // Trial banner
            if let user = authManager.currentUser, user.isTrial {
                Section {
                    if user.trialExpired {
                        Label("Your trial has expired. Upgrade to Pro to continue generating.", systemImage: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                    } else if let ends = user.trialEndsAt {
                        let days = Calendar.current.dateComponents([.day], from: Date(), to: ends).day ?? 0
                        Label("\(days) days left in your trial", systemImage: "clock.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            }

            // Study score
            if let user = authManager.currentUser {
                Section {
                    HStack {
                        Label("Study Score", systemImage: "flame.fill")
                            .foregroundStyle(.orange)
                        Spacer()
                        Text("\(user.studyScore)")
                            .font(.title2.bold())
                    }
                }
            }

            // Decks
            Section("Your Decks") {
                if isLoading {
                    ProgressView()
                } else if decks.isEmpty {
                    ContentUnavailableView(
                        "No Decks Yet",
                        systemImage: "rectangle.stack",
                        description: Text("Generate your first deck of flashcards!")
                    )
                } else {
                    ForEach(decks) { deck in
                        NavigationLink(value: deck.id) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(deck.title)
                                    .font(.headline)
                                HStack(spacing: 12) {
                                    Label("\(deck.cardCount) cards", systemImage: "rectangle.stack")
                                    if deck.isPurchased {
                                        Label("Purchased", systemImage: "bag.fill")
                                    }
                                }
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }
            }
        }
        .navigationTitle("Dashboard")
        .navigationDestination(for: String.self) { deckId in
            DeckDetailView(deckId: deckId)
        }
        .refreshable { await loadDecks() }
        .task { await loadDecks() }
    }

    private func loadDecks() async {
        do {
            let response: DecksResponse = try await APIClient.shared.get("/api/decks")
            decks = response.decks
            isLoading = false
        } catch {
            errorMessage = "Failed to load decks"
            isLoading = false
        }
    }
}

import SwiftUI

struct StudyView: View {
    let deck: Deck

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager
    @State private var currentIndex = 0
    @State private var isFlipped = false
    @State private var correctCount = 0
    @State private var sessionId: String?
    @State private var isComplete = false
    @State private var showRating = false

    private var cards: [Card] { deck.cards ?? [] }
    private var progress: Double {
        guard !cards.isEmpty else { return 0 }
        return Double(currentIndex) / Double(cards.count)
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                if isComplete {
                    completionView
                } else if cards.isEmpty {
                    ContentUnavailableView("No Cards", systemImage: "rectangle.stack")
                } else {
                    // Progress
                    VStack(spacing: 4) {
                        ProgressView(value: progress)
                            .tint(.accentColor)
                        Text("Card \(currentIndex + 1) of \(cards.count)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.horizontal)

                    Spacer()

                    // Card
                    cardView
                        .onTapGesture { flipCard() }

                    Spacer()

                    // Actions
                    if isFlipped {
                        HStack(spacing: 24) {
                            Button {
                                nextCard(correct: false)
                            } label: {
                                Label("Don't Know", systemImage: "xmark.circle.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)

                            Button {
                                nextCard(correct: true)
                            } label: {
                                Label("Know It", systemImage: "checkmark.circle.fill")
                                    .frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .padding(.horizontal)
                    } else {
                        Text("Tap card to flip")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.vertical)
            .navigationTitle(deck.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await startSession() }
            .sheet(isPresented: $showRating) {
                RatingSheet(deckId: deck.id, listingId: deck.purchasedFromListingId)
            }
        }
    }

    private var cardView: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16)
                .fill(.background)
                .shadow(color: .black.opacity(0.1), radius: 8, y: 4)

            VStack(spacing: 12) {
                Text(isFlipped ? "Answer" : "Question")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(isFlipped ? cards[currentIndex].back : cards[currentIndex].front)
                    .font(.title3)
                    .multilineTextAlignment(.center)
            }
            .padding(24)
        }
        .frame(maxWidth: .infinity, maxHeight: 300)
        .padding(.horizontal)
        .rotation3DEffect(
            .degrees(isFlipped ? 180 : 0),
            axis: (x: 0, y: 1, z: 0),
            perspective: 0.5
        )
        .scaleEffect(x: isFlipped ? -1 : 1) // Counter the text flip
        .animation(.spring(duration: 0.4), value: isFlipped)
    }

    private var completionView: some View {
        VStack(spacing: 24) {
            Spacer()
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 64))
                .foregroundStyle(.green)

            Text("Session Complete!")
                .font(.title.bold())

            VStack(spacing: 8) {
                Text("\(correctCount) / \(cards.count) correct")
                    .font(.title2)
                let pct = cards.isEmpty ? 0 : Int(Double(correctCount) / Double(cards.count) * 100)
                Text("\(pct)%")
                    .font(.largeTitle.bold())
                    .foregroundStyle(.tint)
            }

            Spacer()

            if deck.isPurchased {
                Button("Rate This Deck") {
                    showRating = true
                }
                .buttonStyle(.bordered)
            }

            Button("Done") { dismiss() }
                .buttonStyle(.borderedProminent)
                .padding(.horizontal)
        }
    }

    private func flipCard() {
        isFlipped.toggle()
        let generator = UIImpactFeedbackGenerator(style: .light)
        generator.impactOccurred()
    }

    private func nextCard(correct: Bool) {
        if correct { correctCount += 1 }
        isFlipped = false

        if currentIndex + 1 >= cards.count {
            Task { await completeSession() }
        } else {
            currentIndex += 1
        }
    }

    private func startSession() async {
        struct Body: Encodable { let deck_id: String }
        struct Resp: Decodable { let session: StudySession }
        if let resp = try? await APIClient.shared.post(
            "/api/study/start",
            body: Body(deck_id: deck.id)
        ) as Resp {
            sessionId = resp.session.id
        }
    }

    private func completeSession() async {
        isComplete = true
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)

        guard let sessionId else { return }
        struct Body: Encodable { let correct_count: Int; let total_cards: Int }
        struct Resp: Decodable { let session: StudySession; let study_score: Int }
        if let resp = try? await APIClient.shared.patch(
            "/api/study/\(sessionId)",
            body: Body(correct_count: correctCount, total_cards: cards.count)
        ) as Resp {
            // Update user's study score
            await authManager.refreshUser()
        }
    }
}

struct RatingSheet: View {
    let deckId: String
    let listingId: String?
    @Environment(\.dismiss) private var dismiss
    @State private var rating = 0

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Text("How was this deck?")
                    .font(.title2.bold())

                HStack(spacing: 12) {
                    ForEach(1...5, id: \.self) { star in
                        Image(systemName: star <= rating ? "star.fill" : "star")
                            .font(.title)
                            .foregroundStyle(star <= rating ? .yellow : .secondary)
                            .onTapGesture { rating = star }
                    }
                }

                Button("Submit Rating") {
                    Task { await submitRating() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(rating == 0 || listingId == nil)
            }
            .navigationTitle("Rate Deck")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Skip") { dismiss() }
                }
            }
        }
    }

    private func submitRating() async {
        guard let listingId else { return }
        struct Body: Encodable { let listing_id: String; let rating: Int }
        struct Resp: Decodable { let ok: Bool }
        _ = try? await APIClient.shared.post(
            "/api/ratings",
            body: Body(listing_id: listingId, rating: rating)
        ) as Resp
        dismiss()
    }
}

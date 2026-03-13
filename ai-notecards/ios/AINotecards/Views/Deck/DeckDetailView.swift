import SwiftUI

struct DeckDetailView: View {
    let deckId: String

    @State private var deck: Deck?
    @State private var isLoading = true
    @State private var showStudy = false
    @State private var showDeleteConfirm = false
    @State private var editingCard: Card?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
            } else if let deck {
                List {
                    Section {
                        HStack {
                            Label("\(deck.cardCount) cards", systemImage: "rectangle.stack")
                            Spacer()
                            if deck.isPurchased {
                                Label("Purchased", systemImage: "bag.fill")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }

                    Section("Cards") {
                        ForEach(deck.cards ?? []) { card in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(card.front)
                                    .font(.headline)
                                Text(card.back)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                            .contentShape(Rectangle())
                            .onTapGesture {
                                editingCard = card
                            }
                        }
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .primaryAction) {
                        Button {
                            showStudy = true
                        } label: {
                            Label("Study", systemImage: "play.fill")
                        }
                        .disabled(deck.cardCount == 0)
                    }

                    ToolbarItem(placement: .destructiveAction) {
                        Button(role: .destructive) {
                            showDeleteConfirm = true
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            } else {
                ContentUnavailableView("Deck Not Found", systemImage: "exclamationmark.triangle")
            }
        }
        .navigationTitle(deck?.title ?? "Deck")
        .task { await loadDeck() }
        .fullScreenCover(isPresented: $showStudy) {
            if let deck {
                StudyView(deck: deck)
            }
        }
        .confirmationDialog("Delete Deck?", isPresented: $showDeleteConfirm) {
            Button("Delete", role: .destructive) {
                Task { await deleteDeck() }
            }
        } message: {
            Text("This will permanently delete this deck and all its cards.")
        }
        .sheet(item: $editingCard) { card in
            CardEditSheet(deckId: deckId, card: card) {
                Task { await loadDeck() }
            }
        }
    }

    private func loadDeck() async {
        do {
            let response: DeckResponse = try await APIClient.shared.get("/api/decks/\(deckId)")
            deck = response.deck
        } catch {
            deck = nil
        }
        isLoading = false
    }

    private func deleteDeck() async {
        do {
            struct OkResp: Decodable { let ok: Bool }
            let _: OkResp = try await APIClient.shared.delete("/api/decks/\(deckId)")
            dismiss()
        } catch {
            // Show error
        }
    }
}

struct CardEditSheet: View {
    let deckId: String
    let card: Card
    let onSave: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var front: String
    @State private var back: String

    init(deckId: String, card: Card, onSave: @escaping () -> Void) {
        self.deckId = deckId
        self.card = card
        self.onSave = onSave
        _front = State(initialValue: card.front)
        _back = State(initialValue: card.back)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Front") {
                    TextEditor(text: $front)
                        .frame(minHeight: 80)
                }
                Section("Back") {
                    TextEditor(text: $back)
                        .frame(minHeight: 80)
                }
            }
            .navigationTitle("Edit Card")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await save() }
                    }
                    .disabled(front.isEmpty || back.isEmpty)
                }
            }
        }
    }

    private func save() async {
        guard let cardId = card.id else { return }
        struct Body: Encodable { let front: String; let back: String }
        struct Resp: Decodable { let card: Card }
        _ = try? await APIClient.shared.patch(
            "/api/decks/\(deckId)/cards/\(cardId)",
            body: Body(front: front, back: back)
        ) as Resp
        onSave()
        dismiss()
    }
}

import SwiftUI

struct GenerateView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var input = ""
    @State private var title = ""
    @State private var isGenerating = false
    @State private var errorMessage: String?
    @State private var generatedDeckId: String?
    @State private var showPaywall = false

    private var maxChars: Int {
        authManager.currentUser?.isByokPro == true
            ? Constants.maxInputCharsByok
            : Constants.maxInputCharsFree
    }

    var body: some View {
        VStack(spacing: 16) {
            // Title field
            TextField("Deck title (optional)", text: $title)
                .textFieldStyle(.roundedBorder)
                .padding(.horizontal)

            // Input area
            VStack(alignment: .leading, spacing: 4) {
                TextEditor(text: $input)
                    .frame(minHeight: 200)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(.quaternary)
                    )
                    .overlay(alignment: .topLeading) {
                        if input.isEmpty {
                            Text("Paste your notes or type a topic...")
                                .foregroundStyle(.tertiary)
                                .padding(8)
                                .allowsHitTesting(false)
                        }
                    }

                HStack {
                    Text("\(input.count) / \(maxChars.formatted()) chars")
                        .font(.caption)
                        .foregroundStyle(input.count > maxChars ? .red : .secondary)
                    Spacer()
                }
            }
            .padding(.horizontal)

            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
            }

            // Generate button
            Button {
                Task { await generate() }
            } label: {
                if isGenerating {
                    HStack(spacing: 8) {
                        ProgressView()
                        Text("Generating your flashcards...")
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    Label("Generate Flashcards", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(input.trimmingCharacters(in: .whitespacesAndNewlines).count < Constants.minInputChars
                      || input.count > maxChars
                      || isGenerating)
            .padding(.horizontal)

            Spacer()
        }
        .navigationTitle("Generate")
        .navigationDestination(item: $generatedDeckId) { deckId in
            DeckDetailView(deckId: deckId)
        }
        .sheet(isPresented: $showPaywall) {
            PaywallView()
        }
    }

    private func generate() async {
        isGenerating = true
        errorMessage = nil

        do {
            struct GenerateBody: Encodable { let input: String; let title: String? }
            let response: GenerateResponse = try await APIClient.shared.request(
                "POST",
                path: "/api/generate",
                body: GenerateBody(input: input, title: title.isEmpty ? nil : title),
                timeout: Constants.generateTimeout
            )
            generatedDeckId = response.deck.id
            input = ""
            title = ""

            // Haptic feedback on success
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.success)
        } catch let apiError as APIError {
            if apiError.errorCode == .generationLimitReached || apiError.errorCode == .upgradeRequired {
                showPaywall = true
            } else {
                errorMessage = apiError.errorDescription
            }
        } catch {
            if (error as? URLError)?.code == .timedOut {
                errorMessage = "Generation timed out. Try with shorter input."
            } else {
                errorMessage = "Generation failed. Please try again."
            }
        }

        isGenerating = false
    }
}

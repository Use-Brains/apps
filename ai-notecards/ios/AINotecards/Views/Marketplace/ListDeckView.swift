import SwiftUI

struct ListDeckView: View {
    let deckId: String

    @Environment(\.dismiss) private var dismiss
    @State private var categories: [MarketplaceCategory] = []
    @State private var selectedCategoryId: String?
    @State private var description = ""
    @State private var priceCents = 100
    @State private var tags: [String] = []
    @State private var tagInput = ""
    @State private var isSubmitting = false
    @State private var errorMessage: String?

    private let priceOptions = [100, 200, 300, 400, 500]

    var body: some View {
        Form {
            Section("Category") {
                Picker("Category", selection: $selectedCategoryId) {
                    Text("Select...").tag(nil as String?)
                    ForEach(categories) { cat in
                        Text(cat.name).tag(cat.id as String?)
                    }
                }
            }

            Section("Description") {
                TextEditor(text: $description)
                    .frame(minHeight: 80)
                Text("\(description.count) / 500")
                    .font(.caption)
                    .foregroundStyle(description.count > 500 ? .red : .secondary)
            }

            Section("Price") {
                Picker("Price", selection: $priceCents) {
                    ForEach(priceOptions, id: \.self) { cents in
                        Text("$\(cents / 100)").tag(cents)
                    }
                }
                .pickerStyle(.segmented)
            }

            Section("Tags (up to 5)") {
                HStack {
                    TextField("Add tag", text: $tagInput)
                        .onSubmit { addTag() }
                    Button("Add") { addTag() }
                        .disabled(tagInput.isEmpty || tags.count >= 5)
                }

                ForEach(tags, id: \.self) { tag in
                    HStack {
                        Text(tag)
                        Spacer()
                        Button { tags.removeAll { $0 == tag } } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            if let error = errorMessage {
                Section {
                    Text(error).foregroundStyle(.red)
                }
            }
        }
        .navigationTitle("List Deck")
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Publish") {
                    Task { await submit() }
                }
                .disabled(isSubmitting || selectedCategoryId == nil || description.isEmpty || description.count > 500)
            }
        }
        .task { await loadCategories() }
    }

    private func addTag() {
        let tag = tagInput.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !tag.isEmpty, !tags.contains(tag), tags.count < 5 else { return }
        tags.append(tag)
        tagInput = ""
    }

    private func loadCategories() async {
        let resp: CategoriesResponse? = try? await APIClient.shared.get("/api/marketplace/categories")
        categories = resp?.categories ?? []
    }

    private func submit() async {
        guard let categoryId = selectedCategoryId else { return }
        isSubmitting = true
        errorMessage = nil

        struct Body: Encodable {
            let deck_id: String
            let category_id: String
            let description: String
            let price_cents: Int
            let tags: [String]
        }
        struct Resp: Decodable { let listing: MarketplaceListing }

        do {
            let _: Resp = try await APIClient.shared.post(
                "/api/seller/listings",
                body: Body(
                    deck_id: deckId,
                    category_id: categoryId,
                    description: description,
                    price_cents: priceCents,
                    tags: tags
                )
            )
            dismiss()
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "Failed to create listing."
        }

        isSubmitting = false
    }
}

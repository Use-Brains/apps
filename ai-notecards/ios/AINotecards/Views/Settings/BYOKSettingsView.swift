import SwiftUI

struct BYOKSettingsView: View {
    @State private var apiKey = ""
    @State private var maskedKey: String?
    @State private var hasKey = false
    @State private var selectedModel: String?
    @State private var isSaving = false
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var successMessage: String?

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("OpenRouter API Key")
                        .font(.headline)
                    Text("Get your API key from openrouter.ai/keys")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    if hasKey, let masked = maskedKey {
                        HStack {
                            Text("Current key: \(masked)")
                                .font(.subheadline.monospaced())
                                .foregroundStyle(.secondary)
                            Spacer()
                            Button("Remove") {
                                Task { await removeKey() }
                            }
                            .foregroundStyle(.red)
                            .font(.caption)
                        }
                    }

                    SecureField("sk-or-v1-...", text: $apiKey)
                        .textContentType(.none)
                        .autocorrectionDisabled()
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.body, design: .monospaced))

                    Button {
                        Task { await saveKey() }
                    } label: {
                        if isSaving {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Text(hasKey ? "Update Key" : "Save Key")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(apiKey.count < 10 || isSaving)
                }
            } footer: {
                Text("Your key is encrypted at rest. It's validated on first use during generation — not upfront.")
            }

            Section("Preferred Model") {
                let grouped = Dictionary(grouping: Constants.byokModels, by: \.provider)
                ForEach(grouped.keys.sorted(), id: \.self) { provider in
                    Section(provider) {
                        ForEach(grouped[provider]!) { model in
                            Button {
                                selectedModel = model.id
                                Task { await saveModel(model.id) }
                            } label: {
                                HStack {
                                    Text(model.name)
                                        .foregroundStyle(.primary)
                                    Spacer()
                                    if selectedModel == model.id {
                                        Image(systemName: "checkmark")
                                            .foregroundStyle(.tint)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if let error = errorMessage {
                Section { Text(error).foregroundStyle(.red) }
            }
            if let success = successMessage {
                Section { Text(success).foregroundStyle(.green) }
            }
        }
        .navigationTitle("BYOK Settings")
        .task { await loadSettings() }
    }

    private func loadSettings() async {
        struct ProfileResp: Decodable {
            let profile: Profile
            struct Profile: Decodable {
                let preferred_model: String?
                let has_api_key: Bool
                let masked_key: String?
            }
        }

        if let resp: ProfileResp = try? await APIClient.shared.get("/api/settings") {
            hasKey = resp.profile.has_api_key
            maskedKey = resp.profile.masked_key
            selectedModel = resp.profile.preferred_model
        }
        isLoading = false
    }

    private func saveKey() async {
        isSaving = true
        errorMessage = nil
        successMessage = nil

        struct Body: Encodable { let key: String }
        struct Resp: Decodable { let ok: Bool; let has_api_key: Bool; let masked_key: String? }

        do {
            let resp: Resp = try await APIClient.shared.put(
                "/api/settings/api-key",
                body: Body(key: apiKey)
            )
            hasKey = resp.has_api_key
            maskedKey = resp.masked_key
            apiKey = ""
            successMessage = "API key saved. It will be validated on your next generation."

            // Cache in keychain for local display
            if let key = apiKey.data(using: .utf8) {
                try? KeychainManager.save(key, for: Constants.Keychain.apiKeyKey)
            }
        } catch let apiError as APIError {
            errorMessage = apiError.errorDescription
        } catch {
            errorMessage = "Failed to save key."
        }

        isSaving = false
    }

    private func removeKey() async {
        struct Body: Encodable { let key: String? }
        struct Resp: Decodable { let ok: Bool; let has_api_key: Bool; let masked_key: String? }

        do {
            let resp: Resp = try await APIClient.shared.put(
                "/api/settings/api-key",
                body: Body(key: nil)
            )
            hasKey = resp.has_api_key
            maskedKey = resp.masked_key
            KeychainManager.delete(key: Constants.Keychain.apiKeyKey)
            successMessage = "API key removed."
        } catch {
            errorMessage = "Failed to remove key."
        }
    }

    private func saveModel(_ modelId: String) async {
        struct Body: Encodable { let preferred_model: String }
        struct Resp: Decodable { let profile: ProfileData }
        struct ProfileData: Decodable { let preferred_model: String? }

        _ = try? await APIClient.shared.patch(
            "/api/settings",
            body: Body(preferred_model: modelId)
        ) as Resp
    }
}

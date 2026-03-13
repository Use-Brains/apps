import AuthenticationServices
import CryptoKit
import Foundation

@Observable
final class AuthManager {
    var currentUser: User?
    var isAuthenticated: Bool { currentUser != nil }
    var isLoading = false
    var error: String?

    private let api = APIClient.shared

    init() {
        // Check for stored token on launch
        if KeychainManager.readString(key: Constants.Keychain.tokenKey) != nil {
            Task { await checkAuth() }
        }
    }

    // MARK: - Auth Actions

    @MainActor
    func login(email: String, password: String) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            struct LoginBody: Encodable { let email: String; let password: String }
            let response: AuthResponse = try await api.post(
                "/api/auth/login",
                body: LoginBody(email: email, password: password)
            )
            try KeychainManager.save(response.token, for: Constants.Keychain.tokenKey)
            currentUser = response.user
        } catch let apiError as APIError {
            error = apiError.errorDescription
            if case .serverError(let code, _) = apiError, code == .authUseApple {
                error = "This account uses Sign in with Apple. Please use that to sign in."
            }
        } catch {
            self.error = "Login failed. Please try again."
        }
    }

    @MainActor
    func signup(email: String, password: String, displayName: String?) async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            struct SignupBody: Encodable {
                let email: String; let password: String; let display_name: String?
            }
            let response: AuthResponse = try await api.post(
                "/api/auth/signup",
                body: SignupBody(email: email, password: password, display_name: displayName)
            )
            try KeychainManager.save(response.token, for: Constants.Keychain.tokenKey)
            currentUser = response.user
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = "Signup failed. Please try again."
        }
    }

    @MainActor
    func signInWithApple(authorization: ASAuthorization, nonce: String) async {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            error = "Failed to get Apple credentials."
            return
        }

        // Save Apple response to UserDefaults (Apple only provides name/email on FIRST auth)
        let appleData: [String: String] = [
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
            "email": credential.email ?? "",
        ]
        UserDefaults.standard.set(appleData, forKey: "pendingAppleSignIn")

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let savedData = UserDefaults.standard.dictionary(forKey: "pendingAppleSignIn") as? [String: String] ?? appleData
            struct AppleAuthBody: Encodable {
                let identityToken: String
                let nonce: String
                let givenName: String?
                let familyName: String?
                let email: String?
            }
            let response: AuthResponse = try await api.post(
                "/api/auth/apple",
                body: AppleAuthBody(
                    identityToken: identityToken,
                    nonce: nonce,
                    givenName: savedData["givenName"]?.nilIfEmpty,
                    familyName: savedData["familyName"]?.nilIfEmpty,
                    email: savedData["email"]?.nilIfEmpty
                )
            )
            try KeychainManager.save(response.token, for: Constants.Keychain.tokenKey)
            currentUser = response.user
            UserDefaults.standard.removeObject(forKey: "pendingAppleSignIn")
        } catch let apiError as APIError {
            error = apiError.errorDescription
        } catch {
            self.error = "Sign in with Apple failed. Please try again."
        }
    }

    @MainActor
    func logout() async {
        do {
            try await api.postVoid("/api/auth/logout")
        } catch {
            // Logout locally even if server call fails
        }
        KeychainManager.delete(key: Constants.Keychain.tokenKey)
        KeychainManager.delete(key: Constants.Keychain.apiKeyKey)
        currentUser = nil
    }

    @MainActor
    func deleteAccount() async throws {
        struct OkResponse: Decodable { let ok: Bool }
        let _: OkResponse = try await api.delete("/api/auth/account")
        KeychainManager.delete(key: Constants.Keychain.tokenKey)
        KeychainManager.delete(key: Constants.Keychain.apiKeyKey)
        currentUser = nil
    }

    @MainActor
    func checkAuth() async {
        do {
            let response: UserResponse = try await api.get("/api/auth/me")
            currentUser = response.user
            if response.user == nil {
                KeychainManager.delete(key: Constants.Keychain.tokenKey)
            }
        } catch is APIError {
            KeychainManager.delete(key: Constants.Keychain.tokenKey)
            currentUser = nil
        } catch {
            // Network error — keep existing state, don't force logout
        }
    }

    @MainActor
    func refreshUser() async {
        await checkAuth()
    }

    // MARK: - SIWA Nonce

    func generateNonce() async throws -> String {
        struct NonceResponse: Decodable { let nonce: String }
        let response: NonceResponse = try await api.get("/api/auth/apple/nonce")
        return response.nonce
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

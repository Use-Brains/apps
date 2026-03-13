import AuthenticationServices
import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var email = ""
    @State private var password = ""
    @State private var showSignup = false
    @State private var nonce: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Logo / Title
                VStack(spacing: 8) {
                    Image(systemName: "rectangle.stack.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.tint)
                    Text("AI Notecards")
                        .font(.largeTitle.bold())
                    Text("Generate flashcards with AI")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                // Email / Password
                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        .textFieldStyle(.roundedBorder)

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        .textFieldStyle(.roundedBorder)
                }
                .padding(.horizontal)

                if let error = authManager.error {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Button {
                    Task { await authManager.login(email: email, password: password) }
                } label: {
                    if authManager.isLoading {
                        ProgressView()
                            .frame(maxWidth: .infinity)
                    } else {
                        Text("Sign In")
                            .frame(maxWidth: .infinity)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(email.isEmpty || password.isEmpty || authManager.isLoading)
                .padding(.horizontal)

                // Divider
                HStack {
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                    Text("or").font(.caption).foregroundStyle(.secondary)
                    Rectangle().frame(height: 1).foregroundStyle(.quaternary)
                }
                .padding(.horizontal)

                // Sign in with Apple
                SignInWithAppleButton(.signIn) { request in
                    Task {
                        do {
                            let n = try await authManager.generateNonce()
                            nonce = n
                            request.requestedScopes = [.email, .fullName]
                            request.nonce = n
                        } catch {
                            authManager.error = "Failed to prepare Sign in with Apple."
                        }
                    }
                } onCompletion: { result in
                    switch result {
                    case .success(let authorization):
                        guard let nonce else { return }
                        Task { await authManager.signInWithApple(authorization: authorization, nonce: nonce) }
                    case .failure:
                        break // User cancelled
                    }
                }
                .signInWithAppleButtonStyle(.black)
                .frame(height: 50)
                .padding(.horizontal)

                Spacer()

                Button("Don't have an account? Sign Up") {
                    showSignup = true
                }
                .font(.subheadline)
            }
            .navigationDestination(isPresented: $showSignup) {
                SignupView()
            }
        }
    }
}

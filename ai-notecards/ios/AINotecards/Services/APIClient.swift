import Foundation

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let baseURL: String
    private let decoder: JSONDecoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = Constants.defaultTimeout
        session = URLSession(configuration: config)
        baseURL = Constants.apiBaseURL

        decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let dateString = try container.decode(String.self)

            // Try ISO8601 with fractional seconds
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: dateString) { return date }

            // Try without fractional seconds
            formatter.formatOptions = [.withInternetDateTime]
            if let date = formatter.date(from: dateString) { return date }

            // Try date-only format
            let dateOnly = DateFormatter()
            dateOnly.dateFormat = "yyyy-MM-dd"
            if let date = dateOnly.date(from: dateString) { return date }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Cannot decode date: \(dateString)"
            )
        }
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        _ method: String,
        path: String,
        body: (any Encodable)? = nil,
        timeout: TimeInterval? = nil
    ) async throws -> T {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            throw APIError.unknown(0, "Invalid URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = method

        if let timeout {
            request.timeoutInterval = timeout
        }

        // Inject Bearer token
        if let token = KeychainManager.readString(key: Constants.Keychain.tokenKey) {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(body)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.unknown(0, "Invalid response")
        }

        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.forbidden(errorResponse?.message)
        case 404:
            throw APIError.notFound
        case 409:
            let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data)
            throw APIError.conflict(errorResponse?.message)
        default:
            let errorResponse = try? decoder.decode(APIErrorResponse.self, from: data)
            let code = APIErrorCode(rawValue: errorResponse?.error ?? "")
            throw APIError.serverError(code, errorResponse?.message)
        }
    }

    // MARK: - Convenience

    func get<T: Decodable>(_ path: String) async throws -> T {
        try await request("GET", path: path)
    }

    func post<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T {
        try await request("POST", path: path, body: body)
    }

    func put<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T {
        try await request("PUT", path: path, body: body)
    }

    func patch<T: Decodable>(_ path: String, body: (any Encodable)? = nil) async throws -> T {
        try await request("PATCH", path: path, body: body)
    }

    func delete<T: Decodable>(_ path: String) async throws -> T {
        try await request("DELETE", path: path)
    }

    /// POST with no expected response body
    func postVoid(_ path: String, body: (any Encodable)? = nil) async throws {
        let _: EmptyResponse = try await request("POST", path: path, body: body)
    }

    /// DELETE with no response body
    func deleteVoid(_ path: String) async throws {
        let _: EmptyResponse = try await request("DELETE", path: path)
    }
}

private struct EmptyResponse: Decodable {}

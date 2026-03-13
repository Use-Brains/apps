import Foundation

struct StudySession: Codable, Identifiable {
    let id: String
    let deckId: String
    let totalCards: Int
    let correctCount: Int?
    let completedAt: Date?

    enum CodingKeys: String, CodingKey {
        case id
        case deckId = "deck_id"
        case totalCards = "total_cards"
        case correctCount = "correct_count"
        case completedAt = "completed_at"
    }

    var score: Double {
        guard let correct = correctCount, totalCards > 0 else { return 0 }
        return Double(correct) / Double(totalCards) * 100
    }
}

struct StartSessionResponse: Codable {
    let session: StudySession
}

struct CompleteSessionResponse: Codable {
    let session: StudySession
    let studyScore: Int

    enum CodingKeys: String, CodingKey {
        case session
        case studyScore = "study_score"
    }
}

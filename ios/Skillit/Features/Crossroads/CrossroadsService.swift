import Foundation
import SkillitKit

/// The server calls Crossroads makes, so the screen can run with sample data in previews and screenshots.
protocol CrossroadsService: Sendable {
    func crossroads() async throws(SkillitError) -> Crossroads
    func askCrossroads(_ request: QuickUpdateRequest) async throws(SkillitError) -> CrossroadsAnswer
    func standBehind(lineID: String, _ behind: Bool) async throws(SkillitError) -> RoadLine?
    func addToRoad(lineID: String) async throws(SkillitError)
    func forgetMemory(id: String) async throws(SkillitError)
}

extension SkillitClient: CrossroadsService {}

struct UnavailableCrossroads: CrossroadsService {
    func crossroads() async throws(SkillitError) -> Crossroads {
        throw .offline
    }

    func askCrossroads(_: QuickUpdateRequest) async throws(SkillitError) -> CrossroadsAnswer {
        throw .offline
    }

    func standBehind(lineID _: String, _: Bool) async throws(SkillitError) -> RoadLine? {
        throw .offline
    }

    func addToRoad(lineID _: String) async throws(SkillitError) {
        throw .offline
    }

    func forgetMemory(id _: String) async throws(SkillitError) {
        throw .offline
    }
}

extension AppModel {
    var crossroadsService: any CrossroadsService {
        if let client {
            return client
        }
        #if DEBUG
            return SampleCrossroads()
        #else
            return UnavailableCrossroads()
        #endif
    }
}

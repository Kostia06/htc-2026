// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "SkillitKit",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "SkillitKit", targets: ["SkillitKit"])],
    targets: [
        .target(name: "SkillitKit"),
        .testTarget(name: "SkillitKitTests", dependencies: ["SkillitKit"]),
    ],
)

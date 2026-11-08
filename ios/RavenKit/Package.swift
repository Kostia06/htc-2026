// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "RavenKit",
    platforms: [.iOS(.v26), .macOS(.v26)],
    products: [.library(name: "RavenKit", targets: ["RavenKit"])],
    targets: [
        .target(name: "RavenKit"),
        .testTarget(name: "RavenKitTests", dependencies: ["RavenKit"]),
    ],
)

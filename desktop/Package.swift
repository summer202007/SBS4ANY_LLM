// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "SBSDesktop",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(name: "SBSDesktop", targets: ["SBSDesktop"])
    ],
    targets: [
        .executableTarget(
            name: "SBSDesktop",
            path: "Sources/SBSDesktop"
        )
    ]
)

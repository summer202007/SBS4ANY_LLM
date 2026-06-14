import AppKit
import Foundation
import WebKit

private let defaultPort = "3000"

final class SBSDesktopApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var serverProcess: Process?
    private var stdoutPipe: Pipe?
    private var stderrPipe: Pipe?
    private var hasLaunched = false

    private var logURL: URL {
        URL(fileURLWithPath: repoRoot)
            .appendingPathComponent(".build")
            .appendingPathComponent("desktop-dev")
            .appendingPathComponent("SBSDesktop.log")
    }

    private lazy var repoRoot: String = {
        if let root = ProcessInfo.processInfo.environment["SBS_ROOT"], !root.isEmpty {
            return root
        }
        if let resourceURL = Bundle.main.resourceURL {
            let rootFile = resourceURL.appendingPathComponent("repo-root.txt")
            if let root = try? String(contentsOf: rootFile, encoding: .utf8)
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !root.isEmpty {
                return root
            }
            if let bundledRoot = prepareBundledRuntimeRoot(resourceURL: resourceURL) {
                return bundledRoot
            }
        }
        let cwd = FileManager.default.currentDirectoryPath
        if cwd.hasSuffix("/desktop") {
            return String(cwd.dropLast("/desktop".count))
        }
        return cwd
    }()

    private lazy var port: String = {
        ProcessInfo.processInfo.environment["SBS_PORT"] ?? defaultPort
    }()

    private lazy var nodePath: String = {
        if let path = ProcessInfo.processInfo.environment["SBS_NODE_PATH"], !path.isEmpty {
            return path
        }
        if let resourceURL = Bundle.main.resourceURL {
            let nodeFile = resourceURL.appendingPathComponent("node-path.txt")
            if let path = try? String(contentsOf: nodeFile, encoding: .utf8)
                .trimmingCharacters(in: .whitespacesAndNewlines),
               !path.isEmpty {
                return path
            }
            let bundledNode = resourceURL
                .appendingPathComponent("node")
                .appendingPathComponent("bin")
                .appendingPathComponent("node")
            if FileManager.default.isExecutableFile(atPath: bundledNode.path) {
                return bundledNode.path
            }
        }
        for candidate in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"] {
            if FileManager.default.isExecutableFile(atPath: candidate) {
                return candidate
            }
        }
        return "/usr/bin/env"
    }()

    private var appURL: URL {
        URL(string: "http://127.0.0.1:\(port)/")!
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        launch()
    }

    func launch() {
        if hasLaunched {
            return
        }
        hasLaunched = true
        log("launch repoRoot=\(repoRoot) nodePath=\(nodePath) port=\(port)")
        NSApp.setActivationPolicy(.regular)
        buildMenu()
        startServerIfNeeded()
        createWindow()
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationWillTerminate(_ notification: Notification) {
        if let process = serverProcess, process.isRunning {
            log("terminating started server process")
            process.terminate()
        }
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appMenuItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(
            NSMenuItem(
                title: "Quit SBS 4 Any Agent",
                action: #selector(NSApplication.terminate(_:)),
                keyEquivalent: "q"
            )
        )
        appMenuItem.submenu = appMenu
        mainMenu.addItem(appMenuItem)

        let editMenuItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(
            NSMenuItem(
                title: "Cut",
                action: #selector(NSText.cut(_:)),
                keyEquivalent: "x"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Copy",
                action: #selector(NSText.copy(_:)),
                keyEquivalent: "c"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Paste",
                action: #selector(NSText.paste(_:)),
                keyEquivalent: "v"
            )
        )
        editMenu.addItem(
            NSMenuItem(
                title: "Paste and Match Style",
                action: #selector(NSTextView.pasteAsPlainText(_:)),
                keyEquivalent: "v"
            )
        )
        editMenu.items.last?.keyEquivalentModifierMask = [.command, .option, .shift]
        editMenu.addItem(NSMenuItem.separator())
        editMenu.addItem(
            NSMenuItem(
                title: "Select All",
                action: #selector(NSText.selectAll(_:)),
                keyEquivalent: "a"
            )
        )
        editMenuItem.submenu = editMenu
        mainMenu.addItem(editMenuItem)

        let viewMenuItem = NSMenuItem()
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(
            NSMenuItem(
                title: "Reload",
                action: #selector(reloadWebView),
                keyEquivalent: "r"
            )
        )
        viewMenuItem.submenu = viewMenu
        mainMenu.addItem(viewMenuItem)

        NSApp.mainMenu = mainMenu
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.websiteDataStore = .nonPersistent()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1280, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "SBS 4 Any Agent"
        window.center()
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        self.window = window

        waitForServerAndLoad()
    }

    @objc private func reloadWebView() {
        webView?.load(URLRequest(url: appURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData))
    }

    private func prepareBundledRuntimeRoot(resourceURL: URL) -> String? {
        let source = resourceURL.appendingPathComponent("app", isDirectory: true)
        guard FileManager.default.fileExists(atPath: source.path) else {
            return nil
        }

        do {
            let supportRoot = try FileManager.default.url(
                for: .applicationSupportDirectory,
                in: .userDomainMask,
                appropriateFor: nil,
                create: true
            )
            .appendingPathComponent("SBS 4 Any Agent", isDirectory: true)
            let runtimeRoot = supportRoot.appendingPathComponent("runtime", isDirectory: true)
            let markerURL = runtimeRoot.appendingPathComponent(".runtime-version")
            let sourceVersionURL = resourceURL.appendingPathComponent("app-runtime-version.txt")
            let sourceVersion =
                (try? String(contentsOf: sourceVersionURL, encoding: .utf8)
                    .trimmingCharacters(in: .whitespacesAndNewlines))
                ?? "unknown"
            let installedVersion =
                (try? String(contentsOf: markerURL, encoding: .utf8)
                    .trimmingCharacters(in: .whitespacesAndNewlines))
                ?? ""

            if installedVersion != sourceVersion || !FileManager.default.fileExists(atPath: runtimeRoot.path) {
                if FileManager.default.fileExists(atPath: runtimeRoot.path) {
                    try FileManager.default.removeItem(at: runtimeRoot)
                }
                try FileManager.default.createDirectory(at: supportRoot, withIntermediateDirectories: true)
                try FileManager.default.copyItem(at: source, to: runtimeRoot)
                try sourceVersion.write(to: markerURL, atomically: true, encoding: .utf8)
            }

            return runtimeRoot.path
        } catch {
            log("failed to prepare bundled runtime: \(error.localizedDescription)")
            return source.path
        }
    }

    private func startServerIfNeeded() {
        if isServerHealthy() {
            log("SBS server already running at \(appURL.absoluteString)")
            return
        }

        let process = Process()
        process.currentDirectoryURL = URL(fileURLWithPath: repoRoot)
        process.executableURL = URL(fileURLWithPath: nodePath)
        process.arguments = nodePath.hasSuffix("/env")
            ? ["node", "server/index.mjs"]
            : ["server/index.mjs"]

        var environment = ProcessInfo.processInfo.environment
        environment["PORT"] = port
        process.environment = environment

        let stdoutPipe = Pipe()
        let stderrPipe = Pipe()
        process.standardOutput = stdoutPipe
        process.standardError = stderrPipe
        self.stdoutPipe = stdoutPipe
        self.stderrPipe = stderrPipe

        stdoutPipe.fileHandleForReading.readabilityHandler = { handle in
            if let text = String(data: handle.availableData, encoding: .utf8), !text.isEmpty {
                print(text, terminator: "")
            }
        }
        stderrPipe.fileHandleForReading.readabilityHandler = { handle in
            if let text = String(data: handle.availableData, encoding: .utf8), !text.isEmpty {
                fputs(text, stderr)
            }
        }

        do {
            try process.run()
            serverProcess = process
            log("Started SBS server from \(repoRoot)")
        } catch {
            log("Could not start server: \(error.localizedDescription)")
            showFatalError("Could not start local SBS server.\n\n\(error.localizedDescription)")
        }
    }

    private func waitForServerAndLoad() {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            if isServerHealthy() {
                log("Server healthy; loading \(appURL.absoluteString)")
                webView?.load(URLRequest(url: appURL, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData))
                return
            }
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.2))
        }

        log("Server did not become ready")
        showFatalError("Local SBS server did not become ready at \(appURL.absoluteString).")
    }

    private func isServerHealthy() -> Bool {
        guard let healthURL = URL(string: "http://127.0.0.1:\(port)/api/health") else {
            return false
        }

        var request = URLRequest(url: healthURL)
        request.timeoutInterval = 0.6

        let semaphore = DispatchSemaphore(value: 0)
        var ok = false
        let task = URLSession.shared.dataTask(with: request) { data, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200, data != nil {
                ok = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 0.8)
        return ok
    }

    private func log(_ message: String) {
        let line = "[\(Date())] \(message)\n"
        print(line, terminator: "")
        let fileManager = FileManager.default
        try? fileManager.createDirectory(
            at: logURL.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        if let data = line.data(using: .utf8) {
            if fileManager.fileExists(atPath: logURL.path),
               let handle = try? FileHandle(forWritingTo: logURL) {
                _ = try? handle.seekToEnd()
                try? handle.write(contentsOf: data)
                try? handle.close()
            } else {
                try? data.write(to: logURL)
            }
        }
    }

    private func showFatalError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "SBS Workbench could not start"
        alert.informativeText = message
        alert.alertStyle = .critical
        alert.addButton(withTitle: "Quit")
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let app = NSApplication.shared
let delegate = SBSDesktopApp()
app.delegate = delegate
delegate.launch()
app.run()

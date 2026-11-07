import RavenKit
import SwiftUI
import VisionKit

/// The live camera view that reports the first Raven pairing code it sees.
struct QRScannerView: UIViewControllerRepresentable {
    let onCode: (PairingCode) -> Void

    static var isAvailable: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            isHighlightingEnabled: true,
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_: DataScannerViewController, context _: Context) {}

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator _: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onCode: onCode)
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        let onCode: (PairingCode) -> Void

        init(onCode: @escaping (PairingCode) -> Void) {
            self.onCode = onCode
        }

        func dataScanner(_: DataScannerViewController, didAdd items: [RecognizedItem], allItems _: [RecognizedItem]) {
            for case let .barcode(barcode) in items {
                if let payload = barcode.payloadStringValue, let code = PairingCode(scanned: payload) {
                    onCode(code)
                    return
                }
            }
        }
    }
}

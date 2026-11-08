import Foundation

struct MultipartForm {
    let boundary = "skillit-\(UUID().uuidString)"
    private var body = Data()

    var contentType: String {
        "multipart/form-data; boundary=\(boundary)"
    }

    mutating func addFile(field: String, file: ResumeFile) {
        let safeName = file.name.replacingOccurrences(of: "\"", with: "")
        body.append(Data("--\(boundary)\r\n".utf8))
        body.append(Data("Content-Disposition: form-data; name=\"\(field)\"; filename=\"\(safeName)\"\r\n".utf8))
        body.append(Data("Content-Type: application/octet-stream\r\n\r\n".utf8))
        body.append(file.data)
        body.append(Data("\r\n".utf8))
    }

    func encoded() -> Data {
        body + Data("--\(boundary)--\r\n".utf8)
    }
}

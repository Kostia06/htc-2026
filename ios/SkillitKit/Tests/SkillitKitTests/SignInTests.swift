import CryptoKit
import Foundation
@testable import SkillitKit
import Testing

struct SignInNonceTests {
    @Test func `sends Apple the SHA-256 of the nonce it keeps for Supabase`() {
        let nonce = SignInNonce()
        let expected = SHA256.hash(data: Data(nonce.raw.utf8)).map { String(format: "%02x", $0) }.joined()
        #expect(nonce.hashed == expected)
        #expect(nonce.raw.count == 32)
    }

    @Test func `never repeats a nonce`() {
        #expect(SignInNonce().raw != SignInNonce().raw)
    }
}

struct EmailSignInTests {
    @Test(arguments: [" Jordan@Example.com ", "jordan.lee+skillit@school.ca"])
    func `accepts an email address`(typed: String) throws {
        let address = try #require(EmailAddress(typed: typed))
        #expect(address.value == typed.trimmingCharacters(in: .whitespaces).lowercased())
    }

    @Test(arguments: ["", "jordan", "jordan@", "@example.com", "jordan@example", "jo rdan@example.com"])
    func `refuses something that isn't an email address`(typed: String) {
        #expect(EmailAddress(typed: typed) == nil)
    }

    @Test(arguments: ["123456", "123 456", " 123456\n"])
    func `reads a six-digit code however it was pasted`(typed: String) throws {
        #expect(try #require(OneTimeCode(typed: typed)).value == "123456")
    }

    @Test(arguments: ["12345", "1234567", "12345a"])
    func `refuses a code that isn't six digits`(typed: String) {
        #expect(OneTimeCode(typed: typed) == nil)
    }
}

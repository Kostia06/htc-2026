@testable import SkillitKit
import Testing

struct AudioTagsTests {
    @Test func `removes one tag and the space it leaves behind`() {
        #expect("[warmly] Tell me about yourself.".withoutAudioTags == "Tell me about yourself.")
        #expect("Tell me about yourself. [laughs]".withoutAudioTags == "Tell me about yourself.")
    }

    @Test func `removes several tags from the middle of a line`() {
        let line = "[clears throat] So, [pause] what brought you here [laughs softly] today?"
        #expect(line.withoutAudioTags == "So, what brought you here today?")
    }

    @Test func `leaves a line without tags alone`() {
        #expect("Why do you want to work here?".withoutAudioTags == "Why do you want to work here?")
    }

    @Test func `does not leave a space before punctuation`() {
        #expect("Nice to meet you [warmly], ready?".withoutAudioTags == "Nice to meet you, ready?")
    }

    @Test func `strips brackets around anything, even a number`() {
        #expect("You have [3] minutes.".withoutAudioTags == "You have minutes.")
    }

    @Test func `collapses to empty when the line was only tags`() {
        #expect("[sighs] [pause]".withoutAudioTags == "")
    }
}

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useVoiceInput } from "@/lib/hooks/use-voice-input";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  static throwOnStart = false;
  lang = "";
  continuous = false;
  interimResults = false;
  started = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error?: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.instances.push(this);
  }

  start() {
    if (FakeRecognition.throwOnStart) {
      throw new Error("already started");
    }
    this.started = true;
  }

  stop() {
    this.started = false;
    this.onend?.();
  }

  finalTranscript(transcript: string) {
    this.onresult?.({
      resultIndex: 0,
      results: { length: 1, 0: { isFinal: true, length: 1, 0: { transcript } } },
    });
  }
}

function installSpeech() {
  FakeRecognition.instances = [];
  FakeRecognition.throwOnStart = false;
  (window as unknown as { SpeechRecognition: typeof FakeRecognition }).SpeechRecognition =
    FakeRecognition;
}

afterEach(() => {
  delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
  delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
  vi.restoreAllMocks();
});

describe("useVoiceInput", () => {
  it("explains that voice input is unavailable", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));

    act(() => result.current.toggle());
    expect(result.current.message).toBe("Voice input is not supported in this browser.");
    expect(result.current.listening).toBe(false);
  });

  it("starts listening, appends final transcripts and stops", () => {
    installSpeech();
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useVoiceInput(onTranscript));

    act(() => result.current.toggle());
    expect(result.current.listening).toBe(true);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(FakeRecognition.instances[0]).toMatchObject({
      lang: "en-US",
      continuous: false,
      interimResults: false,
    });

    act(() => FakeRecognition.instances[0].finalTranscript("hello world"));
    expect(onTranscript).toHaveBeenCalledWith("hello world");

    act(() => result.current.toggle());
    expect(result.current.listening).toBe(false);
    expect(FakeRecognition.instances[0].started).toBe(false);
  });

  it("reports microphone and unexpected errors", () => {
    installSpeech();
    const { result } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.toggle());
    act(() => FakeRecognition.instances[0].onerror?.({ error: "not-allowed" }));
    expect(result.current.message).toContain("Microphone access was blocked");
    expect(result.current.listening).toBe(false);

    act(() => result.current.toggle());
    act(() => FakeRecognition.instances[1].onerror?.({ error: "network" }));
    expect(result.current.message).toBe("Voice input stopped unexpectedly. Try again.");

    act(() => result.current.clearMessage());
    expect(result.current.message).toBeNull();
  });

  it("handles an already-active recognizer and cleans up on unmount", () => {
    installSpeech();
    FakeRecognition.throwOnStart = true;
    const { result, unmount } = renderHook(() => useVoiceInput(vi.fn()));

    act(() => result.current.toggle());
    expect(result.current.message).toBe("Voice input is already active in another tab.");
    expect(result.current.listening).toBe(false);

    unmount();
    expect(FakeRecognition.instances[0].started).toBe(false);
  });
});

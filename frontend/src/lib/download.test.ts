import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadText } from "@/lib/download";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("downloadText", () => {
  it("creates an object URL, clicks a temporary anchor and cleans up", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:nexa");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadText("workspace.json", '{"ok":true}');

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json;charset=utf-8");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:nexa");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.unstubAllGlobals();
  });
});

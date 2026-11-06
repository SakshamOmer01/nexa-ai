import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins the classes it is given and drops falsy entries", () => {
    expect(cn("rounded-md", false && "hidden", undefined, null, "px-2")).toBe("rounded-md px-2");
  });

  it("lets later Tailwind classes override earlier ones", () => {
    // Components rely on this to let a caller win when overriding a variant's classes.
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });
});

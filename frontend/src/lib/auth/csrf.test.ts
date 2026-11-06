import { describe, expect, it } from "vitest";

import { rejectCrossOrigin } from "@/lib/auth/csrf";

const URL_UNDER_TEST = "http://localhost:3000/api/auth/login";

function request(headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, { method: "POST", headers });
}

async function rejectionBody(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("rejectCrossOrigin", () => {
  it("allows a browser POST from the same origin", () => {
    expect(
      rejectCrossOrigin(
        request({ Origin: "http://localhost:3000", "Sec-Fetch-Site": "same-origin" }),
      ),
    ).toBeNull();
  });

  it("allows non-browser clients that send neither header", () => {
    expect(rejectCrossOrigin(request())).toBeNull();
  });

  it("allows a user-initiated navigation marked sec-fetch-site none", () => {
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "none" }))).toBeNull();
  });

  it("rejects a cross-origin Origin with the shared error envelope", async () => {
    const response = rejectCrossOrigin(request({ Origin: "https://evil.example" }));

    expect(response).not.toBeNull();
    expect(response?.status).toBe(403);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
    await expect(rejectionBody(response as Response)).resolves.toMatchObject({
      error: { code: "csrf_rejected", detail: "Cross-origin request rejected." },
    });
  });

  it("rejects a sibling subdomain, even though it is same-site", () => {
    expect(
      rejectCrossOrigin(
        request({ Origin: "http://app.localhost:3000", "Sec-Fetch-Site": "same-site" }),
      ),
    ).not.toBeNull();
  });

  it("rejects the opaque null origin used by sandboxed documents", () => {
    expect(rejectCrossOrigin(request({ Origin: "null" }))).not.toBeNull();
  });

  it("rejects a matching host on a different port", () => {
    expect(rejectCrossOrigin(request({ Origin: "http://localhost:4000" }))).not.toBeNull();
  });

  it("rejects a cross-site fetch even without an Origin header", () => {
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "cross-site" }))).not.toBeNull();
  });

  it("rejects a request whose own URL cannot be parsed", async () => {
    const malformed = { url: "not a valid url", headers: new Headers() } as unknown as Request;

    const response = rejectCrossOrigin(malformed);

    expect(response?.status).toBe(403);
    await expect(rejectionBody(response as Response)).resolves.toMatchObject({
      error: { code: "csrf_rejected" },
    });
  });

  it("treats sec-fetch-site case-insensitively", () => {
    expect(
      rejectCrossOrigin(
        request({ Origin: "http://localhost:3000", "Sec-Fetch-Site": "Same-Origin" }),
      ),
    ).toBeNull();
    expect(rejectCrossOrigin(request({ "Sec-Fetch-Site": "Cross-Site" }))).not.toBeNull();
  });
});

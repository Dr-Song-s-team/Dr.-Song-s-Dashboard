import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    email: {
      findUnique: vi.fn(),
    },
    emailMetric: {
      create: vi.fn(),
    },
  },
}));

function makeRequest(body: unknown, id = "email-1"): [Request, { params: Promise<{ id: string }> }] {
  const req = new Request(`http://localhost/api/email/${id}/metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const ctx = { params: Promise.resolve({ id }) };
  return [req, ctx];
}

describe("POST /api/email/[id]/metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 201 and persists valid scores", async () => {
    vi.mocked(prisma.email.findUnique).mockResolvedValue({ id: "email-1" } as never);
    vi.mocked(prisma.emailMetric.create).mockResolvedValue({ id: "metric-1" } as never);

    const [req, ctx] = makeRequest({ analysisUsefulness: 4, koreanTranslationAccuracy: 5 });
    const res = await POST(req, ctx);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data).toEqual({ success: true, id: "metric-1" });
    expect(prisma.emailMetric.create).toHaveBeenCalledWith({
      data: { emailId: "email-1", analysisUsefulness: 4, koreanTranslationAccuracy: 5 },
    });
  });

  it("returns 404 when email does not exist", async () => {
    vi.mocked(prisma.email.findUnique).mockResolvedValue(null);

    const [req, ctx] = makeRequest({ analysisUsefulness: 3, koreanTranslationAccuracy: 3 });
    const res = await POST(req, ctx);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toMatch(/not found/i);
    expect(prisma.emailMetric.create).not.toHaveBeenCalled();
  });

  it("returns 400 when analysisUsefulness is missing", async () => {
    const [req, ctx] = makeRequest({ koreanTranslationAccuracy: 3 });
    const res = await POST(req, ctx);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/analysisUsefulness/i);
  });

  it("returns 400 when koreanTranslationAccuracy is missing", async () => {
    const [req, ctx] = makeRequest({ analysisUsefulness: 3 });
    const res = await POST(req, ctx);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/koreanTranslationAccuracy/i);
  });

  it.each([0, 6, 3.5, "5", null])("returns 400 for invalid analysisUsefulness=%s", async (val) => {
    const [req, ctx] = makeRequest({ analysisUsefulness: val, koreanTranslationAccuracy: 3 });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it.each([0, 6, 3.5, "5", null])("returns 400 for invalid koreanTranslationAccuracy=%s", async (val) => {
    const [req, ctx] = makeRequest({ analysisUsefulness: 3, koreanTranslationAccuracy: val });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new Request("http://localhost/api/email/email-1/metrics", {
      method: "POST",
      body: "not json",
    });
    const ctx = { params: Promise.resolve({ id: "email-1" }) };
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });
});

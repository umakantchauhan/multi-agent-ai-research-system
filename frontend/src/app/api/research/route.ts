import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 120; // allow long pipeline

const BACKEND_URL = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const { topic } = await req.json();

    if (!topic || typeof topic !== "string" || topic.trim().length < 2) {
      return NextResponse.json({ error: "Topic is required (min 2 chars)." }, { status: 400 });
    }

    // Try to proxy to Python FastAPI backend if available
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 110000);

      const backendRes = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/api/research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim() }),
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (backendRes.ok) {
        const data = await backendRes.json();
        return NextResponse.json(data, { status: 200 });
      }
      // Backend returned error — surface it to UI instead of silently falling back to mock
      const errText = await backendRes.text().catch(() => "");
      console.warn("Backend error:", backendRes.status, errText);

      // Try to extract FastAPI detail ( {"detail": "..."} )
      let detail = errText;
      try {
        const parsed = JSON.parse(errText);
        detail = parsed.detail || parsed.error || errText;
      } catch {}

      // For quota / rate-limit (429) always forward to UI — do NOT fallback to mock
      const isQuota =
        backendRes.status === 429 ||
        /quota|rate.?limit|resource_exhausted|429/i.test(detail);

      if (isQuota || backendRes.status === 429 || backendRes.status === 500) {
        // Forward with same status so UI can show proper message
        // For 500 we still forward the real error; mock fallback only for unreachable backend
        return NextResponse.json(
          {
            error: detail || "Research pipeline failed. Please try again.",
            code: backendRes.status === 429 ? "QUOTA_EXCEEDED" : "PIPELINE_ERROR",
            status: backendRes.status,
          },
          { status: backendRes.status === 429 ? 429 : backendRes.status }
        );
      }
    } catch (e) {
      // Network/unreachable — fallback to mock is OK (only for fetch failures, not for HTTP errors which already returned above)
      console.warn("Backend not reachable, using mock pipeline:", (e as Error).message);
    }

    // --- Fallback MOCK pipeline (so UI is usable without Python backend) ---
    // Simulates pipeline delay and returns structured mock data
    await new Promise((r) => setTimeout(r, 1200));

    const mock: Record<string, string> = {
      search_results: `Title: Latest research on ${topic} — Overview\nURL: https://example.com/research/${encodeURIComponent(topic)}\nSnippet: Recent developments and reliable sources about ${topic} indicate rapid progress and growing adoption across industries. Key studies highlight...\n----\nTitle: ${topic} — In-depth Analysis\nURL: https://example.com/analysis/${encodeURIComponent(topic)}\nSnippet: Experts analyze ${topic} from multiple angles including technical, ethical and economic perspectives. Snippet truncated for preview...`,
      scraped_content:
        `Deep scrape from top resource for "${topic}":\n\nThis document contains detailed content about ${topic}. It covers background, current state, challenges, and future outlook. (This is mock content — connect the Python backend to get real Tavily + Gemini results.)\n\nKey points extracted:\n• Definition and scope of ${topic}\n• Recent breakthroughs and milestones\n• Applications and use-cases\n• Limitations and open questions\n\nSource text truncated to 800 chars for display.`,
      report: `# Research Report: ${topic}\n\n## Introduction\n${topic} is a rapidly evolving area with significant implications. This report synthesizes recent reliable information to provide a structured overview.\n\n## Key Findings\n\n**1. Rapid Adoption & Innovation**\nRecent sources show accelerated research and deployment. Multiple studies point to improvements in efficiency and scalability.\n\n**2. Practical Applications**\nReal-world adoption spans education, industry, healthcare, and creative fields, with measurable impact.\n\n**3. Challenges & Considerations**\nDespite progress, concerns around reliability, bias, and resource requirements remain. Ongoing work aims to address these gaps.\n\n## Conclusion\n${topic} demonstrates strong momentum. Continued research, open-source collaboration, and responsible development will determine its long-term impact.\n\n## Sources\n- https://example.com/research/${encodeURIComponent(topic)}\n- https://example.com/analysis/${encodeURIComponent(topic)}`,
      feedback: `Score: 8/10\n\nStrengths:\n- Well structured with clear Introduction → Findings → Conclusion flow\n- Covers multiple dimensions (technical, practical, critical)\n- Includes verifiable sources\n\nAreas to Improve:\n- Could add quantitative metrics and year-specific data points\n- Add comparative table vs. alternatives\n\nOne line verdict:\nSolid draft — connect live backend for real citations and deeper critique.`,
    };

    // Attach warning so UI can show banner
    return NextResponse.json(
      {
        ...mock,
        _mock: true,
        _notice:
          "Showing demo data — Python backend not connected. Start the backend (python backend/api.py) to get live Gemini + Tavily results.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal error. Try again." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    backend: BACKEND_URL,
    usage: "POST /api/research { topic: string }",
  });
}

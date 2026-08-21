"use client";

import { useEffect, useRef, useState } from "react";

// Types
type StageId = "search" | "read" | "write" | "critic";
type StageStatus = "idle" | "active" | "done" | "error";

interface ResearchData {
  search_results: string;
  scraped_content: string;
  report: string;
  feedback: string;
  _mock?: boolean;
  _notice?: string;
}

const STAGES: { id: StageId; label: string; sub: string; icon: string }[] = [
  { id: "search", label: "Search Agent", sub: "Tavily • 5 sources", icon: "🔍" },
  { id: "read", label: "Reader Agent", sub: "Scrape & clean", icon: "📖" },
  { id: "write", label: "Writer", sub: "Gemini 2.5 Flash", icon: "✍️" },
  { id: "critic", label: "Critic", sub: "Score + verdict", icon: "🎯" },
];

const EXAMPLES = [
  "Quantum computing in drug discovery",
  "Impact of generative AI on education",
  "Future of solid-state batteries",
  "CRISPR ethics and regulation 2025",
  "Climate tech startups to watch",
  "Multi-agent LLM architectures",
];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [stages, setStages] = useState<Record<StageId, StageStatus>>({
    search: "idle",
    read: "idle",
    write: "idle",
    critic: "idle",
  });
  const [data, setData] = useState<ResearchData | null>(null);
  const [activeTab, setActiveTab] = useState<"search" | "scrape" | "report" | "critic">("report");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ topic: string; ts: number }[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  // load history + theme
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("rf_history") || "[]");
      setHistory(h);
    } catch {}
    try {
      const saved = localStorage.getItem("rf_dark");
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = saved !== null ? saved === "true" : prefersDark;
      setDark(initial);
      document.documentElement.classList.toggle("dark", initial);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try {
      localStorage.setItem("rf_dark", String(dark));
    } catch {}
  }, [dark]);

  const pushHistory = (t: string) => {
    const next = [{ topic: t, ts: Date.now() }, ...history].slice(0, 12);
    setHistory(next);
    localStorage.setItem("rf_history", JSON.stringify(next));
  };

  const parseScore = (feedback: string) => {
    const m = feedback.match(/Score:\s*(\d+(?:\.\d+)?)\/10/i);
    return m ? m[1] : "?";
  };

  const run = async (forcedTopic?: string) => {
    const q = (forcedTopic ?? topic).trim();
    if (!q) return;
    if (q.length < 3) {
      setError("Please enter at least 3 characters.");
      return;
    }
    setError(null);
    setData(null);
    setLoading(true);
    setActiveTab("report");
    setStages({ search: "active", read: "idle", write: "idle", critic: "idle" });
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStages((s) => ({ ...s, search: "done", read: "active" })), 3000));
    timers.push(setTimeout(() => setStages((s) => ({ ...s, read: "done", write: "active" })), 6000));
    timers.push(setTimeout(() => setStages((s) => ({ ...s, write: "done", critic: "active" })), 9500));

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: q }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Surface quota/rate-limit with helpful status code
        const detail = json.error || json.detail || "Research failed";
        const code = json.code || "";
        // Attach status for UI (429 → quota banner)
        const err: Error & { status?: number; code?: string } = new Error(detail);
        err.status = json.status || res.status;
        err.code = code;
        throw err;
      }
      setStages({ search: "done", read: "done", write: "done", critic: "done" });
      setData(json);
      pushHistory(q);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: unknown) {
      const errObj = e as Error & { status?: number; code?: string };
      const msg = errObj?.message || "Something went wrong";
      const isQuota = errObj?.status === 429 || errObj?.code === "QUOTA_EXCEEDED" || /quota|rate.?limit|resource_exhausted|429/i.test(msg);
      setError(msg);
      // If quota hits mid-pipeline, mark current active stage as error; otherwise mark all as error
      if (isQuota) {
        setStages((prev) => {
          // If critic was active, mark it error; otherwise mark search as error and keep other done states
          const active = Object.entries(prev).find(([, v]) => v === "active")?.[0] as StageId | undefined;
          if (active) return { ...prev, [active]: "error" } as Record<StageId, StageStatus>;
          return { search: "done", read: "done", write: "done", critic: "error" };
        });
      } else {
        setStages({ search: "error", read: "idle", write: "idle", critic: "idle" });
      }
    } finally {
      timers.forEach(clearTimeout);
      setLoading(false);
    }
  };

  const copyReport = async () => {
    if (!data?.report) return;
    await navigator.clipboard.writeText(data.report);
  };

  const downloadReport = () => {
    if (!data?.report) return;
    const blob = new Blob([data.report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic || "research"}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    setTopic("");
    setData(null);
    setError(null);
    setStages({ search: "idle", read: "idle", write: "idle", critic: "idle" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#fafaf9] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 dark:bg-zinc-900/70 border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-[64px] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 grid place-items-center text-white font-bold text-[13px] shadow-lg shadow-violet-200 dark:shadow-none">
              RF
            </div>
            <div>
              <div className="font-semibold leading-none tracking-tight">ResearchForge</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Multi-Agent • Search → Read → Write → Critic</div>
            </div>
            <span className="hidden sm:inline-flex ml-2 text-[11px] font-medium px-2 py-1 rounded-full bg-violet-50 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800">
              Gemini 2.5 Flash • Tavily
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark((v) => !v)}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              title={dark ? "Light mode" : "Dark mode"}
              className="h-9 w-9 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition text-sm"
            >
              {dark ? "☀️" : "🌙"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-violet-50/60 to-[#fafaf9] dark:from-zinc-950 dark:via-violet-950/20 dark:to-zinc-950" />
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-[520px] w-[880px] rounded-full bg-gradient-to-br from-violet-200 via-indigo-200 to-fuchsia-200 dark:from-violet-900/30 dark:via-indigo-900/20 dark:to-fuchsia-900/20 opacity-40 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14 pb-6">
          <div className="max-w-3xl">
            <h1 className="mt-2 text-4xl sm:text-5xl font-[750] tracking-tight leading-[1.05]">
              Turn any topic into a
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent"> sourced report </span>
              in seconds.
            </h1>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400 text-base sm:text-lg leading-relaxed">
              Search agent finds reliable sources → Reader scrapes the best URL → Writer drafts a structured report → Critic scores it.
              Built on LangChain + Gemini + Tavily.
            </p>
          </div>

          {/* Search card */}
          <div className="mt-8 bg-white dark:bg-zinc-900 rounded-[20px] border border-zinc-200 dark:border-zinc-800 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.12)] dark:shadow-none p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">⌘</div>
                <input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !loading) run();
                  }}
                  placeholder="Enter a research topic — e.g. Quantum computing in drug discovery"
                  className="w-full h-[52px] pl-10 pr-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-800 focus:border-violet-300 dark:focus:border-violet-700 focus:ring-4 focus:ring-violet-100 dark:focus:ring-violet-900/30 outline-none transition text-[15px] placeholder:text-zinc-400"
                />
              </div>
              <button
                onClick={() => run()}
                disabled={loading}
                className="h-[52px] px-7 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium hover:bg-black dark:hover:bg-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 shrink-0"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 dark:border-zinc-900/30 border-t-white dark:border-t-zinc-900 rounded-full animate-spin" />
                    Researching…
                  </>
                ) : (
                  <>Generate report →</>
                )}
              </button>
              <button
                onClick={clear}
                className="h-[52px] px-5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 font-medium"
              >
                Clear
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Try:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => {
                    setTopic(ex);
                    run(ex);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-black dark:hover:bg-white transition"
                >
                  {ex}
                </button>
              ))}
            </div>

            {error &&
              (() => {
                const isQuota = /quota|rate.?limit|resource_exhausted|429|exceeded your current quota/i.test(error);
                return (
                  <div
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                      isQuota
                        ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200"
                        : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-700 dark:text-red-300"
                    }`}
                  >
                    <div className="font-semibold flex items-center gap-2">
                      <span>{isQuota ? "⚠️ Gemini quota exceeded (429)" : "❌ Research failed"}</span>
                    </div>
                    <div className="mt-1 whitespace-pre-wrap break-words leading-6">{error}</div>
                    {isQuota && (
                      <div className="mt-2 text-xs leading-5 opacity-80">
                        Free tier: 20 requests/day for <code>gemini-2.5-flash</code>. Wait ~30s and retry, or switch to a billed API key / different model.
                        <br />
                        <a href="https://ai.dev/rate-limit" target="_blank" rel="noreferrer" className="underline">
                          Check usage
                        </a>{" "}
                        •{" "}
                        <a href="https://ai.google.dev/gemini-api/docs/rate-limits" target="_blank" rel="noreferrer" className="underline">
                          Rate limits docs
                        </a>
                      </div>
                    )}
                  </div>
                );
              })()}

            {history.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium py-1">Recent:</span>
                {history.slice(0, 6).map((h) => (
                  <button
                    key={h.ts}
                    onClick={() => {
                      setTopic(h.topic);
                      run(h.topic);
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  >
                    {h.topic}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Stepper */}
          <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STAGES.map((s, idx) => {
              const status = stages[s.id];
              const isActive = status === "active";
              const isDone = status === "done";
              const isError = status === "error";
              return (
                <div
                  key={s.id}
                  className={`relative rounded-2xl border p-4 flex gap-3 items-start transition ${
                    isActive
                      ? "border-violet-300 dark:border-violet-700 bg-white dark:bg-zinc-900 shadow-[0_0_0_4px_rgba(124,58,237,0.12)] dark:shadow-[0_0_0_4px_rgba(124,58,237,0.2)]"
                      : isDone
                      ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : isError
                      ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <div className="text-lg leading-none pt-0.5">{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400">0{idx + 1}</span>
                      {isActive && <span className="h-1.5 w-1.5 rounded-full bg-violet-600 animate-pulse" />}
                      {isDone && <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓ done</span>}
                      {isError && <span className="text-red-600 dark:text-red-400 text-xs">error</span>}
                    </div>
                    <div className="font-semibold text-sm leading-tight mt-1">{s.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{s.sub}</div>
                  </div>
                  {isActive && <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div className="h-full w-1/2 bg-gradient-to-r from-violet-600 to-indigo-600 animate-[shimmer_1.2s_ease-in-out_infinite]" style={{ transform: "translateX(-100%)" }} />
                  </div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Results */}
      <div ref={resultRef} className="mx-auto max-w-6xl px-4 sm:px-6 pb-16">
        {loading && !data && (
          <div className="mt-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
            <div className="h-3 w-40 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            <div className="mt-4 space-y-3">
              <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
              <div className="h-4 w-4/6 rounded bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
            </div>
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
              Running multi-agent pipeline… this can take 15–40s with live Gemini + Tavily. Keep this tab open.
            </p>
          </div>
        )}

        {data && (
          <div className="mt-6 grid lg:grid-cols-[1.15fr_0.85fr] gap-6">
            {/* Left: tabs */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              {data._mock && data._notice && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 flex gap-2">
                  <span>⚠️</span>
                  <span>{data._notice} </span>
                </div>
              )}

              <div className="flex gap-1 p-2 border-b border-zinc-100 dark:border-zinc-800 overflow-auto">
                {[
                  { k: "report", label: "Report", count: "" },
                  { k: "search", label: "Search", count: "" },
                  { k: "scrape", label: "Scraped", count: "" },
                  { k: "critic", label: "Critic", count: data.feedback ? `${parseScore(data.feedback)}/10` : "" },
                ].map((t) => (
                  <button
                    key={t.k}
                    onClick={() => setActiveTab(t.k as typeof activeTab)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap border ${
                      activeTab === t.k
                        ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-900 dark:border-white"
                        : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {t.label} {t.count && <span className="opacity-70">• {t.count}</span>}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  onClick={copyReport}
                  className="px-3 py-2.5 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 hidden sm:inline-flex"
                  title="Copy report"
                >
                  Copy
                </button>
                <button
                  onClick={downloadReport}
                  className="px-3 py-2.5 rounded-xl text-sm bg-violet-600 text-white hover:bg-violet-700"
                >
                  Download .md
                </button>
              </div>

              <div className="p-5 sm:p-6 max-h-[640px] overflow-auto">
                {activeTab === "report" && (
                  <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-lg prose-a:text-violet-700 dark:prose-a:text-violet-400">
                    <pre className="whitespace-pre-wrap font-sans leading-7 text-[15px] text-zinc-800 dark:text-zinc-200 break-words">
                      {data.report}
                    </pre>
                  </article>
                )}
                {activeTab === "search" && (
                  <pre className="whitespace-pre-wrap font-mono text-[13px] leading-6 text-zinc-700 dark:text-zinc-300 break-words">
                    {data.search_results || "No search results."}
                  </pre>
                )}
                {activeTab === "scrape" && (
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-6 text-zinc-700 dark:text-zinc-300 break-words">
                    {data.scraped_content || "No scraped content."}
                  </pre>
                )}
                {activeTab === "critic" && (
                  <pre className="whitespace-pre-wrap font-sans text-[14px] leading-7 text-zinc-800 dark:text-zinc-200 break-words">
                    {data.feedback || "No feedback."}
                  </pre>
                )}
              </div>

              <div className="px-5 sm:px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">Topic: {topic}</span>
                <span className="px-2.5 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                  {data._mock ? "Mode: Demo (mock)" : "Mode: Live backend"}
                </span>
              </div>
            </div>

            {/* Right: summary + sources */}
            <div className="space-y-6">
              {/* Critic score */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-white to-violet-50/60 dark:from-zinc-900 dark:to-violet-950/20 p-6">
                <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400">CRITIC SCORE</div>
                <div className="mt-2 flex items-baseline gap-3">
                  <div className="text-5xl font-black tracking-tight">
                    {data.feedback ? parseScore(data.feedback) : "—"}
                    <span className="text-2xl font-semibold text-zinc-400">/10</span>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium ${
                      Number(parseScore(data.feedback)) >= 8
                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300"
                        : Number(parseScore(data.feedback)) >= 6
                        ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300"
                        : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                    }`}
                  >
                    {Number(parseScore(data.feedback)) >= 8 ? "Strong" : Number(parseScore(data.feedback)) >= 6 ? "Good" : "Needs work"}
                  </span>
                </div>
                <div className="mt-4 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-4">
                  <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400">VERDICT</div>
                  <div className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap break-words">
                    {data.feedback?.split("One line verdict:")[1]?.trim() ||
                      data.feedback?.split("\n").slice(-2).join(" ") ||
                      "—"}
                  </div>
                </div>
                <button onClick={() => setActiveTab("critic")} className="mt-4 text-sm font-medium text-violet-700 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300">
                  View full critique →
                </button>
              </div>

              {/* Sources */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
                <div className="text-xs font-semibold tracking-widest text-zinc-500 dark:text-zinc-400">SOURCES EXTRACTED</div>
                <div className="mt-3 space-y-2 max-h-[260px] overflow-auto pr-1">
                  {(() => {
                    const text = `${data.search_results}\n${data.report}`;
                    const urls = Array.from(new Set((text.match(/https?:\/\/[^\s\)\]]+/g) || []).slice(0, 12)));
                    if (urls.length === 0) return <div className="text-sm text-zinc-500 dark:text-zinc-400">No URLs found in results.</div>;
                    return urls.map((u) => (
                      <a
                        key={u}
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="flex gap-2 items-start text-sm p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800 hover:border-violet-200 dark:hover:border-violet-800 hover:bg-violet-50/60 dark:hover:bg-violet-950/20"
                      >
                        <span className="text-violet-600 dark:text-violet-400 mt-0.5">↗</span>
                        <span className="break-all text-zinc-700 dark:text-zinc-300">{u}</span>
                      </a>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && !data && (
          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              { t: "Grounded in real web data", d: "Tavily search + BeautifulSoup scrape ensures fresh, verifiable sources." },
              { t: "Structured reports", d: "Writer produces Intro → Findings → Conclusion → Sources, ready to share." },
              { t: "Built-in critique", d: "Critic agent scores quality and gives actionable improvements." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
                <div className="font-semibold">{c.t}</div>
                <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-6">{c.d}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      </main>

      <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 flex justify-center text-sm text-zinc-500 dark:text-zinc-400">
          <span>© {new Date().getFullYear()} ResearchForge</span>
        </div>
      </footer>
    </div>
  );
}

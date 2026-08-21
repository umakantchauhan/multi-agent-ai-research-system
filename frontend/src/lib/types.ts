export type ResearchStage = "search" | "scrape" | "write" | "critic";

export type StageStatus = "idle" | "running" | "done" | "error";

export interface StageInfo {
  id: ResearchStage;
  label: string;
  description: string;
  status: StageStatus;
}

export interface ResearchResult {
  search_results: string;
  scraped_content: string;
  report: string;
  feedback: string;
}

export interface HistoryEntry {
  id: string;
  topic: string;
  timestamp: number;
  result: ResearchResult;
}

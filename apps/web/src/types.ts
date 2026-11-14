export type { AnalysisRun as ProcessingResult, AnalysisReport } from "../../api/src/core/types";
export interface EmailSummary { id: string; from: string; subject: string }
export interface EmailDetail extends EmailSummary { textBody: string; links?: string[] }
export type UiStatus = "PENDING" | "PROCESSING" | "ANALYZED" | "FAILED";

export interface InboxEmail extends EmailSummary { source: "FIXTURE" | "EXTENSION" }

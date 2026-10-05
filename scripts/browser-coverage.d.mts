import type { FullConfig } from "@playwright/test";
import { CoverageReport } from "monocart-coverage-reports";
export function browserCoverage(project: string, config: FullConfig): CoverageReport;
export function setupBrowserCoverage(): Promise<void>;
export function finishBrowserCoverage(config: FullConfig): Promise<void>;

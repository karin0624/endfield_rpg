import { CoverageReport } from "monocart-coverage-reports";
export function browserCoverage(project: string): CoverageReport;
export const coverageProjects: string[];
export function setupBrowserCoverage(): Promise<void>;
export function finishBrowserCoverage(): Promise<void>;

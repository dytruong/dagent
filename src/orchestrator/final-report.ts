const REQUIRED_SECTIONS = ["Summary", "Evidence", "Conclusion", "Next Actions"] as const;

export interface FinalReportValidation {
  ok: boolean;
  missingSections: string[];
}

export function validateFinalReport(report: string): FinalReportValidation {
  const missingSections = REQUIRED_SECTIONS.filter((section) => {
    const heading = new RegExp(`(^|\\n)${section}\\s*(\\n|$)`, "i");
    return !heading.test(report);
  });

  return {
    ok: missingSections.length === 0,
    missingSections,
  };
}

export function createFinalReportRepairPrompt(report: string, missingSections: string[]): string {
  return [
    "Repair the final operational report so it includes every required section.",
    `Missing sections: ${missingSections.join(", ")}`,
    "Required sections: Summary, Evidence, Conclusion, Next Actions.",
    "Use only the existing conversation and tool results.",
    "Do not request or run any additional tools.",
    "Original response:",
    report,
  ].join("\n");
}

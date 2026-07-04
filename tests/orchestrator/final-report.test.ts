import { describe, expect, it } from "vitest";
import { createFinalReportRepairPrompt, validateFinalReport } from "../../src/orchestrator/final-report.js";

describe("final report validation", () => {
  it("accepts all required sections", () => {
    const report = [
      "Summary",
      "Checked nginx logs.",
      "Evidence",
      "journalctl returned 3 warnings.",
      "Conclusion",
      "nginx is running with warnings.",
      "Next Actions",
      "Run another read-only log check after deployment.",
    ].join("\n");

    expect(validateFinalReport(report)).toEqual({ ok: true, missingSections: [] });
  });

  it("reports missing sections", () => {
    expect(validateFinalReport("Summary\nOnly one section.")).toEqual({
      ok: false,
      missingSections: ["Evidence", "Conclusion", "Next Actions"],
    });
  });

  it("creates a repair prompt without requesting tool reruns", () => {
    const prompt = createFinalReportRepairPrompt("Summary\nDone.", ["Evidence"]);
    expect(prompt).toContain("Do not request or run any additional tools");
    expect(prompt).toContain("Evidence");
  });
});

import { describe, expect, it } from "vitest";
import { deriveCandidateExamState } from "./candidateExamSummary.js";
import type { Exam, ExamEnrollment } from "@exam/domain";

const baseExam = {
  openAt: new Date("2020-01-01"),
  closeAt: new Date("2030-01-01"),
  retakePolicy: "unlimited",
  maxAttempts: 3,
} as Exam;

const enrollment = {
  status: "assigned",
  attemptCount: 0,
} as ExamEnrollment;

describe("deriveCandidateExamState closed exams", () => {
  it("returns closed/none for closed exam without attempts", () => {
    const result = deriveCandidateExamState({
      exam: { ...baseExam, status: "closed" } as Exam,
      enrollment,
      activeAttempt: null,
      resumableAttempt: null,
      latestAttempt: null,
      finalAttempt: null,
      now: new Date("2025-01-01"),
    });
    expect(result).toEqual({
      availabilityStatus: "closed",
      primaryAction: "none",
    });
  });

  it("returns closed/view_result when graded result exists", () => {
    const result = deriveCandidateExamState({
      exam: { ...baseExam, status: "closed" } as Exam,
      enrollment: { ...enrollment, finalScore: 8, finalAttemptId: "a1" },
      activeAttempt: null,
      resumableAttempt: null,
      latestAttempt: null,
      finalAttempt: null,
      now: new Date("2025-01-01"),
    });
    expect(result.primaryAction).toBe("view_result");
    expect(result.availabilityStatus).toBe("closed");
  });

  it("returns closed/none for a canceled exam even with a recorded result", () => {
    const result = deriveCandidateExamState({
      exam: { ...baseExam, status: "canceled" } as Exam,
      enrollment: { ...enrollment, finalScore: 8, finalAttemptId: "a1" },
      activeAttempt: null,
      resumableAttempt: null,
      latestAttempt: null,
      finalAttempt: null,
      now: new Date("2025-01-01"),
    });
    expect(result).toEqual({
      availabilityStatus: "closed",
      primaryAction: "none",
    });
  });
});

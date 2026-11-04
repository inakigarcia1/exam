import { describe, expect, it } from "vitest";
import { cn, formatDuration, formatDurationParts } from "./utils";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "x", "y")).toBe("text-sm y");
  });
});

describe("formatDurationParts", () => {
  it("buckets sub-second durations as ms", () => {
    expect(formatDurationParts(0)).toMatchObject({
      bucket: "ms",
      milliseconds: 0,
    });
    expect(formatDurationParts(500)).toMatchObject({
      bucket: "ms",
      milliseconds: 500,
    });
  });

  it("buckets 1s–59s as seconds", () => {
    expect(formatDurationParts(1000)).toMatchObject({
      bucket: "seconds",
      seconds: 1,
    });
    expect(formatDurationParts(59_000)).toMatchObject({
      bucket: "seconds",
      seconds: 59,
    });
  });

  it("buckets whole minutes without seconds as minutes", () => {
    expect(formatDurationParts(60_000)).toMatchObject({
      bucket: "minutes",
      minutes: 1,
    });
    expect(formatDurationParts(5 * 60_000)).toMatchObject({
      bucket: "minutes",
      minutes: 5,
    });
  });

  it("buckets minutes with leftover seconds as minuteSecond", () => {
    expect(formatDurationParts(90_000)).toMatchObject({
      bucket: "minuteSecond",
      minutes: 1,
      seconds: 30,
    });
  });

  it("buckets whole hours without minutes as hours", () => {
    expect(formatDurationParts(60 * 60_000)).toMatchObject({
      bucket: "hours",
      hours: 1,
    });
  });

  it("buckets hours with leftover minutes as hourMinute", () => {
    expect(formatDurationParts(90 * 60_000)).toMatchObject({
      bucket: "hourMinute",
      hours: 1,
      minutes: 30,
    });
  });
});

describe("formatDuration (es default i18n)", () => {
  it("renders sub-second durations in ms", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("renders seconds with singular and plural tokens", () => {
    expect(formatDuration(1000)).toBe("1 segundo");
    expect(formatDuration(45_000)).toBe("45 segundos");
  });

  it("renders whole minutes with singular and plural tokens", () => {
    expect(formatDuration(60_000)).toBe("1 minuto");
    expect(formatDuration(5 * 60_000)).toBe("5 minutos");
  });

  it("renders minutes with seconds, pluralizing each part", () => {
    expect(formatDuration(90_000)).toBe("1 minuto 30 segundos");
    expect(formatDuration(121_000)).toBe("2 minutos 1 segundo");
  });

  it("renders whole hours with singular and plural tokens", () => {
    expect(formatDuration(60 * 60_000)).toBe("1 hora");
    expect(formatDuration(2 * 60 * 60_000)).toBe("2 horas");
  });

  it("renders hours with minutes, pluralizing each part", () => {
    expect(formatDuration(90 * 60_000)).toBe("1 hora 30 minutos");
    expect(formatDuration(121 * 60_000)).toBe("2 horas 1 minuto");
  });
});

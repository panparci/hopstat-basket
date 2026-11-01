import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  captureStatusLabel,
  isCaptureActive,
  isEmbeddedAppShell,
  shouldOpenExternalForCapture,
} from "./captureStatus.ts";

describe("isCaptureActive", () => {
  it("treats ERROR as offline so calibrate stays gated until reconnect", () => {
    assert.equal(isCaptureActive("ERROR"), false);
    assert.equal(isCaptureActive("IDLE"), false);
    assert.equal(isCaptureActive("CAPTURE_ENDED"), false);
  });

  it("allows OCR states while stream is up", () => {
    assert.equal(isCaptureActive("READY"), true);
    assert.equal(isCaptureActive("CAPTURE_ACTIVE"), true);
    assert.equal(isCaptureActive("SCANNING"), true);
    assert.equal(isCaptureActive("REQUESTING_CAPTURE"), true);
  });
});

describe("captureStatusLabel", () => {
  it("does not say Connection Error (not a WebSocket)", () => {
    const label = captureStatusLabel("ERROR");
    assert.equal(label, "Capture Failed");
    assert.equal(label.toLowerCase().includes("connection"), false);
  });
});

describe("isEmbeddedAppShell", () => {
  it("detects HoopStat WebView markers", () => {
    assert.equal(isEmbeddedAppShell("Mozilla HoopStatApp/1.0", false, false), true);
    assert.equal(isEmbeddedAppShell("Mozilla", true, false), true);
    assert.equal(isEmbeddedAppShell("Mozilla", false, true), true);
    assert.equal(isEmbeddedAppShell("Mozilla", false, false), false);
  });
});

describe("shouldOpenExternalForCapture", () => {
  it("forces external browser in app shell or when displayMedia missing", () => {
    assert.equal(shouldOpenExternalForCapture(true, true), true);
    assert.equal(shouldOpenExternalForCapture(false, false), true);
    assert.equal(shouldOpenExternalForCapture(false, true), false);
  });
});

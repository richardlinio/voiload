/**
 * e2e-fixture.test.ts
 * Guards the contract between the E2E fixture and the real detection code.
 *
 * The E2E suite runs in a real browser, so a fixture that stops emitting the
 * signals detection requires would turn the whole language matrix red for a
 * reason that has nothing to do with the extension. This test parses the
 * fixture HTML in jsdom and runs the shipped dom-utils against it.
 */

// Logger reads __IS_PRODUCTION__, a webpack define that does not exist under jest.
jest.mock("../../extension/scripts/utils/logger", () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { buildFixtureHtml } from "../e2e/fixtures/voice-message-fixture";
import {
  findVoiceMessageElement,
  isConfirmedVoiceMessageSlider,
  getDurationFromSlider,
} from "../../extension/scripts/content/dom-utils";
import { DOM_CONSTANTS } from "../../extension/scripts/utils/constants";

/** Render the fixture body into the jsdom document, minus its inline script. */
function renderFixture(opts: Parameters<typeof buildFixtureHtml>[0]): void {
  const html = buildFixtureHtml(opts);
  const bodyMatch = html.match(/<body>([\s\S]*?)<script>/);
  if (!bodyMatch) {
    throw new Error("fixture body not found");
  }
  document.body.innerHTML = bodyMatch[1] as string;
}

function slider(): Element | null {
  return document.querySelector('[data-testid="voice-slider"]');
}

describe("E2E fixture <-> detection contract", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("emits a slider the shipped detection confirms", () => {
    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 2 });

    const el = slider();
    expect(el).not.toBeNull();
    expect(isConfirmedVoiceMessageSlider(el)).toBe(true);
  });

  it("emits the guard signals detection requires", () => {
    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 2 });

    const container = document.querySelector(
      '[data-testid="voice-container"]'
    ) as Element;
    expect(
      container.querySelector(DOM_CONSTANTS.PLAY_BUTTON_SELECTOR)
    ).not.toBeNull();
    expect(
      DOM_CONSTANTS.DURATION_TEXT_PATTERN.test(container.textContent || "")
    ).toBe(true);
  });

  it("renders the duration as an mm:ss label", () => {
    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 61 });
    expect(
      document.querySelector('[data-testid="voice-duration"]')?.textContent
    ).toBe("1:01");

    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 7 });
    expect(
      document.querySelector('[data-testid="voice-duration"]')?.textContent
    ).toBe("0:07");
  });

  it("wraps the slider so the guard must walk up to the container", () => {
    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 2 });

    const el = slider() as Element;
    // The direct parent is a bare wrapper, as on the real page.
    const wrapper = el.parentElement as Element;
    expect(wrapper.querySelector(DOM_CONSTANTS.PLAY_BUTTON_SELECTOR)).toBeNull();
  });

  it("exposes the duration the RIGHT_CLICK message carries", () => {
    renderFixture({ ariaLabel: "Audio scrubber", durationSeconds: 2 });
    expect(getDurationFromSlider(slider() as Element)).toBe(2);
  });

  it("is detected for a locale outside the label dictionary", () => {
    renderFixture({ ariaLabel: "Penggeser audio", durationSeconds: 2 });

    expect(findVoiceMessageElement(slider())).toEqual({
      element: slider(),
      type: "slider",
    });
  });

  it("is detected when the play control label is localized", () => {
    renderFixture({
      ariaLabel: "Ползунок аудио",
      durationSeconds: 2,
      playButtonLabel: "Воспроизвести",
    });

    expect(isConfirmedVoiceMessageSlider(slider())).toBe(true);
  });

  describe("negative cases stay negative", () => {
    it("no slider rendered", () => {
      renderFixture({
        ariaLabel: "unused",
        durationSeconds: 2,
        renderSlider: false,
      });
      expect(slider()).toBeNull();
    });

    it("no play control", () => {
      renderFixture({
        ariaLabel: "Audio scrubber",
        durationSeconds: 2,
        renderPlayButton: false,
      });
      expect(isConfirmedVoiceMessageSlider(slider())).toBe(false);
    });

    it("no mm:ss duration label", () => {
      renderFixture({
        ariaLabel: "Audio scrubber",
        durationSeconds: 2,
        renderDurationText: false,
      });
      expect(isConfirmedVoiceMessageSlider(slider())).toBe(false);
    });

    it("video player scrubber", () => {
      renderFixture({
        ariaLabel: "Video scrubber",
        durationSeconds: 2,
        renderVideo: true,
      });
      expect(isConfirmedVoiceMessageSlider(slider())).toBe(false);
    });
  });

  it("covers every label in the dictionary", () => {
    for (const label of DOM_CONSTANTS.VOICE_MESSAGE_SLIDER_ARIA_LABEL) {
      renderFixture({ ariaLabel: label, durationSeconds: 2 });
      expect(isConfirmedVoiceMessageSlider(slider())).toBe(true);
    }
  });
});

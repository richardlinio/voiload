/**
 * dom-utils.test.ts
 * Unit tests for dom-utils module
 *
 * Fixtures mirror the DOM measured on a real logged-in messenger.com thread:
 * a slider carrying role/aria-valuemin/aria-valuemax, wrapped in a bare div,
 * whose grandparent container also holds a play control and mm:ss text.
 * See .session/w4-notes.md for the captured evidence.
 */

// Mock the logger before importing
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock("../../../extension/scripts/utils/logger", () => ({
  Logger: {
    debug: mockLogger.debug,
    info: mockLogger.info,
    warn: mockLogger.warn,
    error: mockLogger.error,
  },
}));

// NOTE: DOM_CONSTANTS is intentionally NOT mocked. The selector, guard
// signals and label dictionary under test are exactly the shipped values.

describe("dom-utils", () => {
  let domUtils: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    document.body.innerHTML = "";

    domUtils = require("../../../extension/scripts/content/dom-utils");
  });

  // ================================================
  // Fixture builders
  // ================================================

  interface VoiceFixtureOptions {
    ariaLabel?: string | null;
    durationSeconds?: string;
    ariaValueMin?: string | null;
    /** Text rendered in the container, e.g. "0:07". */
    durationText?: string | null;
    /** Render the play control (role=button) in the container. */
    renderPlayButton?: boolean;
    /** Render a <video> in the container (marks it as a video player). */
    renderVideo?: boolean;
    /** aria-label given to the play control. Localized on real pages. */
    playButtonLabel?: string;
  }

  /**
   * Build the real voice-message shape:
   *   container > [ playButton, wrapper > slider, durationText ]
   * The slider sits 2 hops below the container, as measured on the real page.
   */
  function buildVoiceMessage(opts: VoiceFixtureOptions = {}): {
    container: HTMLElement;
    slider: HTMLElement;
    wrapper: HTMLElement;
  } {
    const {
      ariaLabel = "Audio scrubber",
      durationSeconds = "7",
      ariaValueMin = "0",
      durationText = "0:07",
      renderPlayButton = true,
      renderVideo = false,
      playButtonLabel = "Play",
    } = opts;

    const container = document.createElement("div");
    container.setAttribute("data-testid", "voice-container");

    if (renderPlayButton) {
      const playButton = document.createElement("div");
      playButton.setAttribute("role", "button");
      playButton.setAttribute("aria-label", playButtonLabel);
      playButton.innerHTML = '<svg aria-hidden="true"></svg>';
      container.appendChild(playButton);
    }

    if (renderVideo) {
      container.appendChild(document.createElement("video"));
    }

    // hop 1: a bare wrapper carrying no signals (matches the real DOM)
    const wrapper = document.createElement("div");
    const slider = document.createElement("div");
    slider.setAttribute("role", "slider");
    if (ariaValueMin !== null) {
      slider.setAttribute("aria-valuemin", ariaValueMin);
    }
    slider.setAttribute("aria-valuemax", durationSeconds);
    slider.setAttribute("aria-valuenow", "0");
    if (ariaLabel !== null) {
      slider.setAttribute("aria-label", ariaLabel);
    }
    wrapper.appendChild(slider);
    container.appendChild(wrapper);

    if (durationText !== null) {
      const time = document.createElement("span");
      time.textContent = durationText;
      container.appendChild(time);
    }

    document.body.appendChild(container);
    return { container, slider, wrapper };
  }

  // ================================================
  // isVoiceMessageSlider - attribute-level check
  // ================================================

  describe("isVoiceMessageSlider", () => {
    it("returns true for a slider with valuemin=0 and a numeric valuemax", () => {
      const { slider } = buildVoiceMessage();
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(true);
    });

    it("returns true regardless of the aria-label language", () => {
      // Indonesian: deliberately absent from the label dictionary.
      const { slider } = buildVoiceMessage({
        ariaLabel: "Penggeser audio",
      });
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(true);
    });

    it("returns true when the slider has no aria-label at all", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: null });
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(true);
    });

    it("returns false for null element", () => {
      expect(domUtils.isVoiceMessageSlider(null)).toBe(false);
    });

    it("returns false for non-element nodes", () => {
      expect(
        domUtils.isVoiceMessageSlider(document.createTextNode("x") as any)
      ).toBe(false);
    });

    it("returns false for an element without slider role", () => {
      const { slider } = buildVoiceMessage();
      slider.setAttribute("role", "button");
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(false);
    });

    it("returns false when aria-valuemin is not 0", () => {
      const { slider } = buildVoiceMessage({ ariaValueMin: "10" });
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(false);
    });

    it("returns false when aria-valuemin is missing", () => {
      const { slider } = buildVoiceMessage({ ariaValueMin: null });
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(false);
    });

    it("returns false when aria-valuemax is not numeric", () => {
      const { slider } = buildVoiceMessage({ durationSeconds: "invalid" });
      expect(domUtils.isVoiceMessageSlider(slider)).toBe(false);
    });

    it("returns false when aria-valuemax is zero or negative", () => {
      expect(
        domUtils.isVoiceMessageSlider(
          buildVoiceMessage({ durationSeconds: "0" }).slider
        )
      ).toBe(false);
      document.body.innerHTML = "";
      expect(
        domUtils.isVoiceMessageSlider(
          buildVoiceMessage({ durationSeconds: "-5" }).slider
        )
      ).toBe(false);
    });
  });

  // ================================================
  // hasKnownVoiceMessageLabel - auxiliary signal
  // ================================================

  describe("hasKnownVoiceMessageLabel", () => {
    it("recognises a label from the dictionary", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: "Audio scrubber" });
      expect(domUtils.hasKnownVoiceMessageLabel(slider)).toBe(true);
    });

    it("recognises a non-English dictionary label", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: "音訊滑桿" });
      expect(domUtils.hasKnownVoiceMessageLabel(slider)).toBe(true);
    });

    it("returns false for a label outside the dictionary", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: "Penggeser audio" });
      expect(domUtils.hasKnownVoiceMessageLabel(slider)).toBe(false);
    });

    it("returns false when the label is missing", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: null });
      expect(domUtils.hasKnownVoiceMessageLabel(slider)).toBe(false);
    });
  });

  // ================================================
  // isConfirmedVoiceMessageSlider - guarded check
  // ================================================

  describe("isConfirmedVoiceMessageSlider", () => {
    it("confirms a real voice message slider", () => {
      const { slider } = buildVoiceMessage();
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(true);
    });

    it("confirms a slider whose language is outside the dictionary", () => {
      // The headline acceptance case: an Indonesian aria-label must still work.
      const { slider } = buildVoiceMessage({ ariaLabel: "Penggeser audio" });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(true);
    });

    it("confirms a slider whose play control has a localized label", () => {
      // The play button's aria-label is localized too; it must not be matched.
      const { slider } = buildVoiceMessage({
        ariaLabel: "Ползунок аудио",
        playButtonLabel: "Воспроизвести",
      });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(true);
    });

    it("rejects a slider whose container has no play control", () => {
      // e.g. a standalone volume slider
      const { slider } = buildVoiceMessage({ renderPlayButton: false });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(false);
    });

    it("rejects a slider whose container has no mm:ss duration text", () => {
      const { slider } = buildVoiceMessage({ durationText: null });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(false);
    });

    it("rejects a video player scrubber", () => {
      // A video scrubber has a play control and a time label, but also a <video>.
      const { slider } = buildVoiceMessage({
        ariaLabel: "Video scrubber",
        renderVideo: true,
        durationText: "1:23",
      });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(false);
    });

    it("rejects a bare volume slider with no companion controls", () => {
      const volume = document.createElement("div");
      volume.setAttribute("role", "slider");
      volume.setAttribute("aria-valuemin", "0");
      volume.setAttribute("aria-valuemax", "100");
      volume.setAttribute("aria-label", "Volume");
      document.body.appendChild(volume);

      expect(domUtils.isConfirmedVoiceMessageSlider(volume)).toBe(false);
    });

    it("returns false for null", () => {
      expect(domUtils.isConfirmedVoiceMessageSlider(null)).toBe(false);
    });

    it("logs a debug note when the label is unrecognised but still confirms", () => {
      const { slider } = buildVoiceMessage({ ariaLabel: "Penggeser audio" });
      expect(domUtils.isConfirmedVoiceMessageSlider(slider)).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Voice message slider with an unrecognised aria-label",
        { ariaLabel: "Penggeser audio" }
      );
    });
  });

  // ================================================
  // getDurationFromSlider
  // ================================================

  describe("getDurationFromSlider", () => {
    it("returns the duration from a valid slider element", () => {
      const { slider } = buildVoiceMessage({ durationSeconds: "30.5" });
      expect(domUtils.getDurationFromSlider(slider)).toBe(30.5);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Successfully got duration from slider element",
        { durationSec: 30.5 }
      );
    });

    it("handles integer duration values", () => {
      const { slider } = buildVoiceMessage({ durationSeconds: "45" });
      expect(domUtils.getDurationFromSlider(slider)).toBe(45);
    });

    it("reads the duration from real-world values (7 / 3 / 61 seconds)", () => {
      for (const seconds of ["7", "3", "61"]) {
        document.body.innerHTML = "";
        const { slider } = buildVoiceMessage({ durationSeconds: seconds });
        expect(domUtils.getDurationFromSlider(slider)).toBe(Number(seconds));
      }
    });

    it("returns the duration even when the aria-label is unknown", () => {
      const { slider } = buildVoiceMessage({
        ariaLabel: "Penggeser audio",
        durationSeconds: "12",
      });
      expect(domUtils.getDurationFromSlider(slider)).toBe(12);
    });

    it("returns null for a non-slider element", () => {
      const div = document.createElement("div");
      document.body.appendChild(div);

      expect(domUtils.getDurationFromSlider(div)).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to get duration from a non-slider element",
        { element: "DIV" }
      );
    });

    it("returns null when aria-valuemax is missing", () => {
      const { slider } = buildVoiceMessage();
      slider.removeAttribute("aria-valuemax");

      expect(domUtils.getDurationFromSlider(slider)).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Slider element is missing aria-valuemax attribute",
        { element: "DIV" }
      );
    });

    it("returns null when aria-valuemax is invalid", () => {
      const { slider } = buildVoiceMessage({ durationSeconds: "invalid" });

      expect(domUtils.getDurationFromSlider(slider)).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Invalid duration value from slider element",
        { element: "DIV", ariaValueMax: "invalid" }
      );
    });
  });

  // ================================================
  // isPotentialVoiceMessageContainer
  // ================================================

  describe("isPotentialVoiceMessageContainer", () => {
    it("returns true for an element containing a voice message slider", () => {
      const { container } = buildVoiceMessage();
      expect(domUtils.isPotentialVoiceMessageContainer(container)).toBe(true);
    });

    it("returns true for a container in a language outside the dictionary", () => {
      const { container } = buildVoiceMessage({ ariaLabel: "Penggeser audio" });
      expect(domUtils.isPotentialVoiceMessageContainer(container)).toBe(true);
    });

    it("returns false for null element", () => {
      expect(domUtils.isPotentialVoiceMessageContainer(null)).toBe(false);
    });

    it("returns false for non-element nodes", () => {
      expect(
        domUtils.isPotentialVoiceMessageContainer(
          document.createTextNode("x") as any
        )
      ).toBe(false);
    });

    it("returns false for an element without a voice message slider", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span>no slider here</span>";
      document.body.appendChild(div);
      expect(domUtils.isPotentialVoiceMessageContainer(div)).toBe(false);
    });

    it("returns false for a container holding only a video scrubber", () => {
      const { container } = buildVoiceMessage({
        renderVideo: true,
        durationText: "1:23",
      });
      expect(domUtils.isPotentialVoiceMessageContainer(container)).toBe(false);
    });
  });

  // ================================================
  // findVoiceMessageElement
  // ================================================

  describe("findVoiceMessageElement", () => {
    it("returns null for null element", () => {
      expect(domUtils.findVoiceMessageElement(null)).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Attempted to find voice message element on a null element"
      );
    });

    it("returns the element itself when it is a voice message slider", () => {
      const { slider } = buildVoiceMessage();

      expect(domUtils.findVoiceMessageElement(slider)).toEqual({
        element: slider,
        type: "slider",
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Found voice message slider element directly"
      );
    });

    it("finds the slider inside the clicked element", () => {
      const { container, slider } = buildVoiceMessage();

      expect(domUtils.findVoiceMessageElement(container)).toEqual({
        element: slider,
        type: "slider",
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Found voice message slider inside the element"
      );
    });

    it("traverses up the DOM tree to find the voice message container", () => {
      // Right-clicking the duration text: neither it nor its subtree holds the
      // slider, so the search has to walk up.
      const { container, slider } = buildVoiceMessage();
      const timeText = container.querySelector("span") as HTMLElement;

      expect(domUtils.findVoiceMessageElement(timeText)).toEqual({
        element: slider,
        type: "slider",
      });
    });

    it("finds the slider when right-clicking the play button", () => {
      const { container, slider } = buildVoiceMessage();
      const playButton = container.querySelector(
        '[role="button"]'
      ) as HTMLElement;

      expect(domUtils.findVoiceMessageElement(playButton)).toEqual({
        element: slider,
        type: "slider",
      });
    });

    it("finds a slider whose language is outside the dictionary", () => {
      const { container, slider } = buildVoiceMessage({
        ariaLabel: "Penggeser audio",
      });

      expect(domUtils.findVoiceMessageElement(container)).toEqual({
        element: slider,
        type: "slider",
      });
    });

    it("returns null when no voice message element is found", () => {
      const div = document.createElement("div");
      div.innerHTML = "<span>nothing</span>";
      document.body.appendChild(div);
      const span = div.querySelector("span") as HTMLElement;

      expect(domUtils.findVoiceMessageElement(span)).toBe(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        "Could not find voice message element"
      );
    });

    it("does not match a video player scrubber", () => {
      const { container } = buildVoiceMessage({
        ariaLabel: "Video scrubber",
        renderVideo: true,
        durationText: "1:23",
      });

      expect(domUtils.findVoiceMessageElement(container)).toBe(null);
    });

    it("picks the voice slider when a video player sits alongside it", () => {
      const { slider } = buildVoiceMessage();
      // A separate video player elsewhere on the page must not confuse the search.
      buildVoiceMessage({
        ariaLabel: "Video scrubber",
        renderVideo: true,
        durationText: "1:23",
      });

      const page = document.body;
      const result = domUtils.findVoiceMessageElement(page.firstElementChild);
      expect(result).toEqual({ element: slider, type: "slider" });
    });
  });
});

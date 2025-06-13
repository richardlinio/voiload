/**
 * audio-url-registration-handler.test.ts
 * Unit tests for audio-url-registration-handler module
 */

// Mock modules
jest.mock("../../../../extension/scripts/utils/constants", () => ({
  MODULE_NAMES: {
    AUDIO_URL_REGISTRATION_HANDLER: "audio-url-registration-handler",
  },
}));

jest.mock("../../../../extension/scripts/utils/logger", () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    })),
  },
}));

describe("audio-url-registration-handler.ts", () => {
  let mockLogger: any;
  let audioUrlRegistrationHandler: any;
  let mockVoiceMessagesStore: any;
  let mockSender: any;
  let mockSendResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    // Create mock voice messages store
    mockVoiceMessagesStore = {
      items: new Map(),
      registerDownloadUrl: jest.fn(),
    };

    // Create mock sender and response
    mockSender = {
      tab: { id: 123 },
    };
    mockSendResponse = jest.fn();

    // Set up mocks
    const { Logger } = require("../../../../extension/scripts/utils/logger");
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Import after mocks are set up
    audioUrlRegistrationHandler = require("../../../../extension/scripts/background/handlers/audio-url-registration-handler");
  });

  describe("handleAudioUrlRegistration", () => {
    describe("Normal Cases", () => {
      it("should successfully register audio URL with all parameters", () => {
        const mockId = "generated-id-123";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          5000,
          "https://example.com/audio.mp3"
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully registered Audio URL, ID: ${mockId}, duration: 5000ms`
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId,
        });
      });

      it("should register audio URL without timestamp", () => {
        const mockId = "generated-id-456";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const message = {
          audioUrl: "https://example.com/audio.wav",
          durationMs: 3000,
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          3000,
          "https://example.com/audio.wav"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId,
        });
      });

      it("should log current store state after registration", () => {
        const mockId = "generated-id-789";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        // Add some items to simulate store size
        mockVoiceMessagesStore.items.set("item1", { id: "item1" });
        mockVoiceMessagesStore.items.set("item2", { id: "item2" });
        mockVoiceMessagesStore.items.set("item3", { id: "item3" });

        const message = {
          audioUrl: "https://example.com/audio.ogg",
          durationMs: 7500,
          timestamp: "2023-10-21T15:30:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Current voiceMessagesStore item count",
          { itemsCount: 3 }
        );
      });
    });

    describe("Validation and Error Handling", () => {
      it("should handle null voiceMessagesStore", () => {
        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          null,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "voiceMessagesStore does not exist"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Internal error: voiceMessagesStore does not exist",
        });
        expect(
          mockVoiceMessagesStore.registerDownloadUrl
        ).not.toHaveBeenCalled();
      });

      it("should handle undefined voiceMessagesStore", () => {
        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 5000,
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          undefined,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "voiceMessagesStore does not exist"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Internal error: voiceMessagesStore does not exist",
        });
      });

      it("should handle missing audioUrl", () => {
        const message = {
          audioUrl: "",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Audio URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Audio URL or duration information",
        });
        expect(
          mockVoiceMessagesStore.registerDownloadUrl
        ).not.toHaveBeenCalled();
      });

      it("should handle null audioUrl", () => {
        const message = {
          audioUrl: null,
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Audio URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Audio URL or duration information",
        });
      });

      it("should handle missing durationMs", () => {
        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: null,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Audio URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Audio URL or duration information",
        });
      });

      it("should handle zero durationMs", () => {
        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 0,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Audio URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Audio URL or duration information",
        });
      });

      it("should handle undefined durationMs", () => {
        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: undefined,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Missing required Audio URL or duration information"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: "Missing required Audio URL or duration information",
        });
      });

      it("should handle registration error from voiceMessagesStore", () => {
        const errorMessage = "Registration failed";
        mockVoiceMessagesStore.registerDownloadUrl.mockImplementation(() => {
          throw new Error(errorMessage);
        });

        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 5000,
          timestamp: "2023-10-21T10:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error occurred while registering Audio URL",
          {
            error: errorMessage,
            stack: expect.any(String),
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message: `Error occurred while registering Audio URL: ${errorMessage}`,
        });
      });

      it("should handle registration error with custom error object", () => {
        const customError = new Error("Custom registration error");
        customError.stack = "custom stack trace";
        mockVoiceMessagesStore.registerDownloadUrl.mockImplementation(() => {
          throw customError;
        });

        const message = {
          audioUrl: "https://example.com/audio.mp3",
          durationMs: 5000,
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          "Error occurred while registering Audio URL",
          {
            error: "Custom registration error",
            stack: "custom stack trace",
          }
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          message:
            "Error occurred while registering Audio URL: Custom registration error",
        });
      });
    });

    describe("Logging and Debug Information", () => {
      it("should log detailed debug information on successful registration", () => {
        const mockId = "debug-test-id";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const message = {
          audioUrl: "https://example.com/debug-test.mp3",
          durationMs: 8000,
          timestamp: "2023-10-21T12:15:30.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Audio URL registration message",
          {
            audioUrl: "https://example.com/debug-test.mp3",
            durationMs: 8000,
            timestamp: "2023-10-21T12:15:30.000Z",
          }
        );
      });

      it("should log debug information without timestamp", () => {
        const mockId = "no-timestamp-id";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const message = {
          audioUrl: "https://example.com/no-timestamp.mp3",
          durationMs: 4500,
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.debug).toHaveBeenCalledWith(
          "Handling Audio URL registration message",
          {
            audioUrl: "https://example.com/no-timestamp.mp3",
            durationMs: 4500,
            timestamp: undefined,
          }
        );
      });
    });

    describe("Edge Cases", () => {
      it("should handle very long audio URL", () => {
        const mockId = "long-url-id";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const longUrl = "https://example.com/" + "a".repeat(1000) + ".mp3";
        const message = {
          audioUrl: longUrl,
          durationMs: 12000,
          timestamp: "2023-10-21T16:45:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          12000,
          longUrl
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId,
        });
      });

      it("should handle very large duration values", () => {
        const mockId = "large-duration-id";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const largeDuration = 999999999; // Very large duration
        const message = {
          audioUrl: "https://example.com/large-duration.mp3",
          durationMs: largeDuration,
          timestamp: "2023-10-21T20:00:00.000Z",
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          largeDuration,
          "https://example.com/large-duration.mp3"
        );
        expect(mockLogger.info).toHaveBeenCalledWith(
          `Successfully registered Audio URL, ID: ${mockId}, duration: ${largeDuration}ms`
        );
      });

      it("should handle audio URLs with special characters", () => {
        const mockId = "special-chars-id";
        mockVoiceMessagesStore.registerDownloadUrl.mockReturnValue(mockId);

        const specialUrl =
          "https://example.com/audio%20file%20(1).mp3?token=abc123&v=2";
        const message = {
          audioUrl: specialUrl,
          durationMs: 6500,
        };

        const result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.registerDownloadUrl).toHaveBeenCalledWith(
          6500,
          specialUrl
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId,
        });
      });
    });

    describe("Integration Tests", () => {
      it("should work with realistic audio URL registration workflow", () => {
        const mockId1 = "workflow-id-1";
        const mockId2 = "workflow-id-2";
        mockVoiceMessagesStore.registerDownloadUrl
          .mockReturnValueOnce(mockId1)
          .mockReturnValueOnce(mockId2);

        // First registration
        const message1 = {
          audioUrl: "https://cdn.facebook.com/audio1.mp3",
          durationMs: 4200,
          timestamp: "2023-10-21T09:30:00.000Z",
        };

        let result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message1,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenLastCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId1,
        });

        // Second registration with different parameters
        mockSendResponse.mockClear();
        const message2 = {
          audioUrl: "https://cdn.facebook.com/audio2.wav",
          durationMs: 7800,
          timestamp: "2023-10-21T10:15:00.000Z",
        };

        result = audioUrlRegistrationHandler.handleAudioUrlRegistration(
          mockVoiceMessagesStore,
          message2,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(
          mockVoiceMessagesStore.registerDownloadUrl
        ).toHaveBeenCalledTimes(2);
        expect(
          mockVoiceMessagesStore.registerDownloadUrl
        ).toHaveBeenNthCalledWith(
          2,
          7800,
          "https://cdn.facebook.com/audio2.wav"
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: "Successfully registered Audio URL",
          id: mockId2,
        });
      });
    });
  });
});

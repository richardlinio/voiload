/**
 * element-registration-handler.test.ts
 * Unit tests for element-registration-handler module
 */

// Chrome APIs are already mocked in setup.js

// Mock modules
jest.mock('../../../../extension/scripts/utils/constants', () => ({
  MODULE_NAMES: {
    ELEMENT_REGISTRATION_HANDLER: 'element-registration-handler'
  }
}));

jest.mock('../../../../extension/scripts/utils/logger', () => ({
  Logger: {
    createModuleLogger: jest.fn(() => ({
      debug: jest.fn(),
      error: jest.fn()
    }))
  }
}));

// Set up global chrome mock
// global.chrome is already set in setup.js

describe('element-registration-handler.ts', () => {
  let mockLogger: any;
  let elementRegistrationHandler: any;
  let mockVoiceMessagesStore: any;
  let mockSender: any;
  let mockSendResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    
    // Reset chrome API to normal state
    // global.chrome is already set in setup.js
    
    // Reset chrome API mocks
    (global.chrome as any).tabs.sendMessage.mockClear();

    // Create fresh mock logger for each test
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    };

    // Create mock voice messages store
    mockVoiceMessagesStore = {
      items: new Map()
    };

    // Create mock sender and response
    mockSender = {
      tab: { id: 123 }
    };
    mockSendResponse = jest.fn();

    // Set up mocks
    const { Logger } = require('../../../../extension/scripts/utils/logger');
    Logger.createModuleLogger.mockReturnValue(mockLogger);

    // Import after mocks are set up
    elementRegistrationHandler = require('../../../../extension/scripts/background/handlers/element-registration-handler');
  });

  describe('handleElementRegistration', () => {
    describe('Normal Cases', () => {
      it('should register element without matching download URL', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.items.get('element-123')).toEqual({
          id: 'element-123',
          element: null,
          durationMs: 5000,
          downloadUrl: null,
          lastModified: null,
          timestamp: mockTimestamp,
          isPending: true
        });
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        jest.restoreAllMocks();
      });

      it('should register element and match with existing download URL', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Pre-populate store with matching item
        mockVoiceMessagesStore.items.set('existing-item', {
          id: 'existing-item',
          durationMs: 5003, // Within tolerance of 5ms
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT',
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        
        // Check that element was registered
        const registeredElement = mockVoiceMessagesStore.items.get('element-123');
        expect(registeredElement).toEqual({
          id: 'element-123',
          element: null,
          durationMs: 5000,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT',
          timestamp: mockTimestamp,
          isPending: true
        });

        // Check response
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT'
        });

        // Check that content script was notified
        expect((global.chrome as any).tabs.sendMessage).toHaveBeenCalledWith(123, {
          action: 'updateVoiceMessageElement',
          elementId: 'element-123',
          downloadUrl: 'https://example.com/audio.mp3'
        });

        jest.restoreAllMocks();
      });

      it('should handle element registration without tab ID', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Pre-populate store with matching item
        mockVoiceMessagesStore.items.set('existing-item', {
          id: 'existing-item',
          durationMs: 5000,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const senderWithoutTab = { tab: undefined };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          senderWithoutTab,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: null
        });

        // Should not try to send message to content script
        expect((global.chrome as any).tabs.sendMessage).not.toHaveBeenCalled();

        jest.restoreAllMocks();
      });

      it('should handle matching within tolerance boundaries', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Test exact tolerance boundary (5ms)
        mockVoiceMessagesStore.items.set('boundary-item', {
          id: 'boundary-item',
          durationMs: 5005, // Exactly 5ms difference
          downloadUrl: 'https://example.com/boundary.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/boundary.mp3',
          lastModified: null
        });

        jest.restoreAllMocks();
      });

      it('should not match items outside tolerance', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Item outside tolerance (6ms difference)
        mockVoiceMessagesStore.items.set('outside-tolerance', {
          id: 'outside-tolerance',
          durationMs: 5006,
          downloadUrl: 'https://example.com/outside.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        jest.restoreAllMocks();
      });

      it('should not match items without download URL', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Item without download URL
        mockVoiceMessagesStore.items.set('no-url-item', {
          id: 'no-url-item',
          durationMs: 5000,
          downloadUrl: null,
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: true
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        jest.restoreAllMocks();
      });

      it('should not match the same element ID', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Pre-populate with same element ID
        mockVoiceMessagesStore.items.set('element-123', {
          id: 'element-123',
          durationMs: 5000,
          downloadUrl: 'https://example.com/same.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        jest.restoreAllMocks();
      });
    });

    describe('Validation and Error Handling', () => {
      it('should handle missing elementId', () => {
        const message = {
          elementId: '',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Missing required information or voiceMessagesStore does not exist'
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Missing required information'
        });
      });

      it('should handle missing durationMs', () => {
        const message = {
          elementId: 'element-123',
          durationMs: 0
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Missing required information or voiceMessagesStore does not exist'
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Missing required information'
        });
      });

      it('should handle null voiceMessagesStore', () => {
        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          null,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Missing required information or voiceMessagesStore does not exist'
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Missing required information'
        });
      });

      it('should handle exceptions during registration', () => {
        // Mock store.items.set to throw an error
        const mockStore = {
          items: {
            set: jest.fn(() => {
              throw new Error('Store operation failed');
            }),
            get: jest.fn(),
            entries: jest.fn(() => [])
          }
        };

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error occurred while handling voice message element registration:',
          expect.any(Error)
        );
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Store operation failed'
        });
      });

      it('should handle chrome.tabs.sendMessage error', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Mock sendMessage to throw error
        (global.chrome as any).tabs.sendMessage.mockImplementation(() => {
          throw new Error('Failed to send message');
        });

        // Pre-populate store with matching item
        mockVoiceMessagesStore.items.set('existing-item', {
          id: 'existing-item',
          durationMs: 5000,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: null
        });
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error occurred while sending update message to content script:',
          expect.any(Error)
        );

        jest.restoreAllMocks();
      });
    });

    describe('Edge Cases', () => {
      it('should handle update when element no longer exists in store', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Pre-populate store with matching item
        mockVoiceMessagesStore.items.set('existing-item', {
          id: 'existing-item',
          durationMs: 5000,
          downloadUrl: 'https://example.com/audio.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        // Mock get to return undefined after initial set
        const originalGet = mockVoiceMessagesStore.items.get;
        mockVoiceMessagesStore.items.get = jest.fn((id) => {
          if (id === 'element-123') {
            return undefined; // Simulate item was deleted
          }
          return originalGet.call(mockVoiceMessagesStore.items, id);
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockLogger.error).toHaveBeenCalledWith('Cannot find item to update', {
          elementId: 'element-123'
        });

        jest.restoreAllMocks();
      });

      it('should handle multiple matching items and return first match', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Add multiple matching items
        mockVoiceMessagesStore.items.set('match-1', {
          id: 'match-1',
          durationMs: 5002,
          downloadUrl: 'https://example.com/first.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 2000,
          isPending: false
        });

        mockVoiceMessagesStore.items.set('match-2', {
          id: 'match-2',
          durationMs: 5001,
          downloadUrl: 'https://example.com/second.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        // Should match the first one in iteration order
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/first.mp3',
          lastModified: null
        });

        jest.restoreAllMocks();
      });

      it('should handle items without durationMs', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Item without durationMs
        mockVoiceMessagesStore.items.set('no-duration', {
          id: 'no-duration',
          durationMs: null,
          downloadUrl: 'https://example.com/no-duration.mp3',
          lastModified: null,
          timestamp: mockTimestamp - 1000,
          isPending: false
        });

        const message = {
          elementId: 'element-123',
          durationMs: 5000
        };

        const result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        jest.restoreAllMocks();
      });
    });

    describe('Integration Tests', () => {
      it('should work with realistic registration flow', () => {
        const mockTimestamp = 1234567890000;
        jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

        // Step 1: Register element without matching URL
        const message1 = {
          elementId: 'element-123',
          durationMs: 5000
        };

        let result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message1,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.items.size).toBe(1);
        expect(mockSendResponse).toHaveBeenLastCalledWith({
          success: true,
          message: 'Element registered, but no matching download URL'
        });

        // Step 2: Add a matching URL to store
        mockVoiceMessagesStore.items.set('url-item', {
          id: 'url-item',
          durationMs: 5002,
          downloadUrl: 'https://example.com/matched.mp3',
          lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT',
          timestamp: mockTimestamp - 500,
          isPending: false
        });

        // Step 3: Register another element that should match
        mockSendResponse.mockClear();
        const message2 = {
          elementId: 'element-456',
          durationMs: 5000
        };

        result = elementRegistrationHandler.handleElementRegistration(
          mockVoiceMessagesStore,
          message2,
          mockSender,
          mockSendResponse
        );

        expect(result).toBe(true);
        expect(mockVoiceMessagesStore.items.size).toBe(3);
        expect(mockSendResponse).toHaveBeenCalledWith({
          success: true,
          downloadUrl: 'https://example.com/matched.mp3',
          lastModified: 'Wed, 21 Oct 2015 07:28:00 GMT'
        });

        // Verify the matched element was updated
        const matchedElement = mockVoiceMessagesStore.items.get('element-456');
        expect(matchedElement.downloadUrl).toBe('https://example.com/matched.mp3');
        expect(matchedElement.lastModified).toBe('Wed, 21 Oct 2015 07:28:00 GMT');

        jest.restoreAllMocks();
      });
    });
  });
});
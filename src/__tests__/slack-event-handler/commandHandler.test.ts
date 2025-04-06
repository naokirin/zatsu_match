// モックを変数に入れて先に定義
const mockSlackFunctions = {
  sendSlackEphemeralMessage: jest.fn()
};

const mockRegisterAvailability = jest.fn();

// モックをインポートより前に設定
jest.mock('../../utils/slack', () => mockSlackFunctions);
jest.mock('../../utils/availability', () => {
  const originalModule = jest.requireActual('../../utils/availability');

  return {
    ...originalModule,
    registerAvailability: mockRegisterAvailability,
  }
});

import { handleSlackCommand } from '../../slack-event-handler/commandHandler';
import { SlackCommand } from '../../types/slack';
import { sendSlackEphemeralMessage } from '../../utils/slack';

describe('Slack Command Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSlackCommand', () => {
    it('should handle /zatsu_match command', async () => {
      const mockCommand: SlackCommand = {
        command: '/zatsu_match',
        user_id: 'test-user',
        channel_id: 'test-channel',
        text: 'register 2024-01-02 10:00-11:00',
        response_url: 'https://test.com',
      };

      await handleSlackCommand(mockCommand, { traceId: 'test-trace-id' });

      expect(mockRegisterAvailability).toHaveBeenCalledTimes(1);
    });

    it('should handle unknown command', async () => {
      const mockCommand: SlackCommand = {
        command: '/unknown',
        user_id: 'test-user',
        channel_id: 'test-channel',
        text: '',
        response_url: 'https://test.com',
      };

      await handleSlackCommand(mockCommand, { traceId: 'test-trace-id' });

      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        'test-channel',
        'test-user',
        'Unknown command: /unknown'
      );
    });
  });
}); 
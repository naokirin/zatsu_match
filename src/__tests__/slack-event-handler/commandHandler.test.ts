// モックを変数に入れて先に定義
const mockSlackFunctions = {
  getSlackChannelMembers: jest.fn(),
  sendSlackEphemeralMessage: jest.fn()
};

const mockMatchingService = {
  getInstance: jest.fn().mockReturnValue({
    matchUsers: jest.fn().mockResolvedValue([['user1', 'user2'], ['user3', 'user4']]),
    updateUserScore: jest.fn()
  })
};

const mockHuddleService = {
  getInstance: jest.fn().mockReturnValue({
    createHuddle: jest.fn().mockResolvedValue(undefined)
  })
};

// モックをインポートより前に設定
jest.mock('../../utils/slack', () => mockSlackFunctions);
jest.mock('../../services/matching/matchingService', () => ({
  MatchingService: mockMatchingService
}));
jest.mock('../../services/huddle/huddleService', () => ({
  HuddleService: mockHuddleService
}));

import { handleSlackCommand } from '../../slack-event-handler/commandHandler';
import { SlackCommand } from '../../types/slack';
import { getSlackChannelMembers, sendSlackEphemeralMessage } from '../../utils/slack';

describe('Slack Command Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSlackCommand', () => {
    it('should handle /match command', async () => {
      const mockCommand: SlackCommand = {
        command: '/match',
        user_id: 'test-user',
        channel_id: 'test-channel',
        text: '',
        response_url: 'https://test.com',
      };

      const mockMembers = ['user1', 'user2', 'user3', 'user4'];
      (getSlackChannelMembers as jest.Mock).mockResolvedValue(mockMembers);

      await handleSlackCommand(mockCommand, { traceId: 'test-trace-id' });

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(mockMatchingService.getInstance().matchUsers).toHaveBeenCalledWith(mockMembers);
      expect(mockHuddleService.getInstance().createHuddle).toHaveBeenCalledTimes(2);
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

      expect(getSlackChannelMembers).not.toHaveBeenCalled();
      expect(mockMatchingService.getInstance().matchUsers).not.toHaveBeenCalled();
      expect(mockHuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        'test-channel',
        'test-user',
        'Unknown command: /unknown'
      );
    });
  });
}); 
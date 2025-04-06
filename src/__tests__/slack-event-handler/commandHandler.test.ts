// モックを変数に入れて先に定義
const mockSlackFunctions = {
  getSlackChannelMembers: jest.fn(),
  sendSlackMessage: jest.fn(),
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
import { getSlackChannelMembers, sendSlackMessage, sendSlackEphemeralMessage } from '../../utils/slack';

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
      expect(sendSlackMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle /score command with valid score', async () => {
      const mockCommand: SlackCommand = {
        command: '/score',
        user_id: 'test-user',
        channel_id: 'test-channel',
        text: '5',
        response_url: 'https://test.com',
      };

      await handleSlackCommand(mockCommand, { traceId: 'test-trace-id' });

      expect(mockMatchingService.getInstance().updateUserScore).toHaveBeenCalledWith('test-user', 5);
      expect(sendSlackEphemeralMessage).toHaveBeenCalledWith(
        'test-channel',
        'test-user',
        'Your score has been updated to 5! 🎯'
      );
    });

    it('should not update score for /score command with invalid score', async () => {
      const mockCommand: SlackCommand = {
        command: '/score',
        user_id: 'test-user',
        channel_id: 'test-channel',
        text: 'invalid',
        response_url: 'https://test.com',
      };

      await handleSlackCommand(mockCommand, { traceId: 'test-trace-id' });

      expect(mockMatchingService.getInstance().updateUserScore).not.toHaveBeenCalled();
      expect(sendSlackEphemeralMessage).not.toHaveBeenCalled();
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
      expect(sendSlackMessage).not.toHaveBeenCalled();
      expect(sendSlackEphemeralMessage).not.toHaveBeenCalled();
    });
  });
}); 
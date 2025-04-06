// モックを変数に入れて先に定義
const mockSlackFunctions = {
  getSlackChannelMembers: jest.fn()
};

const mockMatchingService = {
  getInstance: jest.fn().mockReturnValue({
    matchUsers: jest.fn().mockResolvedValue([['user1', 'user2'], ['user3', 'user4']])
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

import { handleSlackEvent } from '../../slack-event-handler/eventHandler';
import { SlackEvent } from '../../types/slack';
import { getSlackChannelMembers } from '../../utils/slack';

describe('Slack Event Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('handleSlackEvent', () => {
    it('should handle message event', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'test-user',
          text: 'test message',
          channel: 'test-channel',
          ts: '1234567890',
        },
      };

      const mockMembers = ['user1', 'user2', 'user3', 'user4'];
      (getSlackChannelMembers as jest.Mock).mockResolvedValue(mockMembers);

      await handleSlackEvent(mockEvent, { traceId: 'test-trace-id' });

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(mockMatchingService.getInstance().matchUsers).toHaveBeenCalledWith(mockMembers);
      expect(mockHuddleService.getInstance().createHuddle).toHaveBeenCalledTimes(2);
    });

    it('should not create huddles when there are no members', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'test-user',
          text: 'test message',
          channel: 'test-channel',
          ts: '1234567890',
        },
      };

      (getSlackChannelMembers as jest.Mock).mockResolvedValue([]);

      await handleSlackEvent(mockEvent, { traceId: 'test-trace-id' });

      expect(mockHuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
    });

    it('should not handle non-message events', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'non_message',
          user: 'test-user',
          text: 'test message',
          channel: 'test-channel',
          ts: '1234567890',
        },
      };

      await handleSlackEvent(mockEvent, { traceId: 'test-trace-id' });

      expect(getSlackChannelMembers).not.toHaveBeenCalled();
      expect(mockHuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
    });

    it('should not handle message events without user or channel', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: '',
          text: 'test message',
          channel: '',
          ts: '1234567890',
        },
      };

      await handleSlackEvent(mockEvent, { traceId: 'test-trace-id' });

      expect(getSlackChannelMembers).not.toHaveBeenCalled();
      expect(mockHuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
    });
  });
}); 
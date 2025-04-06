import { handleSlackEvent } from '../../../slack-event-handler/eventHandler';
import { SlackEvent } from '../../../types/slack';
import { getSlackChannelMembers } from '../../../utils/slack';
import { HuddleService } from '../../../services/huddle/huddleService';

jest.mock('../../../utils/slack');
jest.mock('../../../services/huddle/huddleService');

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
          channel: 'test-channel',
          text: 'test message',
          ts: '1234567890',
        },
      };

      const mockMembers = ['user1', 'user2', 'user3', 'user4'];
      (getSlackChannelMembers as jest.Mock).mockResolvedValue(mockMembers);

      await handleSlackEvent(mockEvent);

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(HuddleService.getInstance().createHuddle).toHaveBeenCalledTimes(2);
    });

    it('should not create huddles for odd number of members', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'test-user',
          channel: 'test-channel',
          text: 'test message',
          ts: '1234567890',
        },
      };

      const mockMembers = ['user1', 'user2', 'user3'];
      (getSlackChannelMembers as jest.Mock).mockResolvedValue(mockMembers);

      await handleSlackEvent(mockEvent);

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(HuddleService.getInstance().createHuddle).toHaveBeenCalledTimes(1);
    });

    it('should handle empty channel members', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'message',
          user: 'test-user',
          channel: 'test-channel',
          text: 'test message',
          ts: '1234567890',
        },
      };

      const mockMembers: string[] = [];
      (getSlackChannelMembers as jest.Mock).mockResolvedValue(mockMembers);

      await handleSlackEvent(mockEvent);

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(HuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
    });

    it('should handle non-message event type', async () => {
      const mockEvent: SlackEvent = {
        type: 'event_callback',
        event: {
          type: 'reaction_added',
          user: 'test-user',
          channel: 'test-channel',
          text: 'test message',
          ts: '1234567890',
        },
      };

      await handleSlackEvent(mockEvent);

      expect(getSlackChannelMembers).not.toHaveBeenCalled();
      expect(HuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
    });
  });
}); 
import { handleSlackCommand } from '../../../slack-event-handler/commandHandler';
import { SlackCommand } from '../../../types/slack';
import { getSlackChannelMembers, sendSlackMessage, sendSlackEphemeralMessage } from '../../../utils/slack';
import { MatchingService } from '../../../services/matching/matchingService';
import { HuddleService } from '../../../services/huddle/huddleService';

jest.mock('../../../utils/slack');
jest.mock('../../../services/matching/matchingService');
jest.mock('../../../services/huddle/huddleService');

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

      await handleSlackCommand(mockCommand);

      expect(getSlackChannelMembers).toHaveBeenCalledWith('test-channel');
      expect(MatchingService.getInstance().matchUsers).toHaveBeenCalledWith(mockMembers);
      expect(HuddleService.getInstance().createHuddle).toHaveBeenCalledTimes(2);
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

      await handleSlackCommand(mockCommand);

      expect(MatchingService.getInstance().updateUserScore).toHaveBeenCalledWith('test-user', 5);
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

      await handleSlackCommand(mockCommand);

      expect(MatchingService.getInstance().updateUserScore).not.toHaveBeenCalled();
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

      await handleSlackCommand(mockCommand);

      expect(getSlackChannelMembers).not.toHaveBeenCalled();
      expect(MatchingService.getInstance().matchUsers).not.toHaveBeenCalled();
      expect(HuddleService.getInstance().createHuddle).not.toHaveBeenCalled();
      expect(sendSlackMessage).not.toHaveBeenCalled();
      expect(sendSlackEphemeralMessage).not.toHaveBeenCalled();
    });
  });
}); 
import { WebClient } from '@slack/web-api';
import { SlackUser } from '../../types/slack';
import { getSlackUserInfo } from '../../utils/slack';

export class HuddleService {
  private static instance: HuddleService;
  private slack: WebClient;

  private constructor() {
    this.slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  }

  public static getInstance(): HuddleService {
    if (!HuddleService.instance) {
      HuddleService.instance = new HuddleService();
    }
    return HuddleService.instance;
  }

  public async createHuddle(userId1: string, userId2: string): Promise<void> {
    const user1 = await getSlackUserInfo(userId1);
    const user2 = await getSlackUserInfo(userId2);

    const channelName = this.generateChannelName(user1, user2);
    const channel = await this.createChannel(channelName);

    await this.inviteUsers(channel.id, [userId1, userId2]);
    await this.sendWelcomeMessage(channel.id, user1, user2);
  }

  private generateChannelName(user1: SlackUser, user2: SlackUser): string {
    const names = [user1.name, user2.name].sort();
    return `huddle-${names[0]}-${names[1]}`;
  }

  private async createChannel(name: string): Promise<{ id: string }> {
    const result = await this.slack.conversations.create({
      name,
      is_private: true,
    });
    if (!result.channel?.id) {
      throw new Error('Failed to create channel: No channel ID returned');
    }
    return { id: result.channel.id };
  }

  private async inviteUsers(channelId: string, userIds: string[]): Promise<void> {
    await Promise.all(
      userIds.map((userId) =>
        this.slack.conversations.invite({
          channel: channelId,
          users: userId,
        })
      )
    );
  }

  private async sendWelcomeMessage(
    channelId: string,
    user1: SlackUser,
    user2: SlackUser
  ): Promise<void> {
    const message = `Welcome to your huddle! 👋\n\n${user1.real_name} and ${user2.real_name}, have a great conversation!`;
    await this.slack.chat.postMessage({
      channel: channelId,
      text: message,
    });
  }
} 
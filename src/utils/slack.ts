import { WebClient } from '@slack/web-api';
import { SlackUser, SlackChannel, SlackMessage } from '../types/slack';
import { SlackApiError } from './errors';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function getSlackUserInfo(userId: string): Promise<SlackUser> {
  const result = await slack.users.info({ user: userId });
  return result.user as SlackUser;
}

export async function getSlackChannelInfo(channelId: string): Promise<SlackChannel> {
  const result = await slack.conversations.info({ channel: channelId });
  return result.channel as SlackChannel;
}

export async function getSlackClient(): Promise<WebClient> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new SlackApiError('Missing Slack bot token');
  }
  return new WebClient(token);
}

export async function getSlackChannelMembers(channelId: string): Promise<string[]> {
  try {
    const client = await getSlackClient();
    const response = await client.conversations.members({
      channel: channelId,
    });

    if (!response.members || !response.ok) {
      throw new SlackApiError('Failed to get channel members', response);
    }

    return response.members;
  } catch (error) {
    throw new SlackApiError('Error getting channel members', error);
  }
}

export async function sendSlackMessage(channelId: string, message: string | SlackMessage): Promise<void> {
  try {
    const client = await getSlackClient();

    const payload = typeof message === 'string'
      ? { text: message, channel: channelId }
      : { ...message, channel: channelId };

    const response = await client.chat.postMessage(payload);

    if (!response.ok) {
      throw new SlackApiError('Failed to send message', response);
    }
  } catch (error) {
    throw new SlackApiError('Error sending message', error);
  }
}

export async function sendSlackEphemeralMessage(
  channelId: string,
  userId: string,
  message: string | SlackMessage
): Promise<void> {
  try {
    const client = await getSlackClient();

    const payload = typeof message === 'string'
      ? { text: message, channel: channelId, user: userId }
      : { ...message, channel: channelId, user: userId };

    const response = await client.chat.postEphemeral(payload);

    if (!response.ok) {
      throw new SlackApiError('Failed to send ephemeral message', response);
    }
  } catch (error) {
    throw new SlackApiError('Error sending ephemeral message', error);
  }
} 
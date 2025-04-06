import { WebClient } from '@slack/web-api';
import { SlackUser, SlackChannel } from '../types/slack';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function getSlackUserInfo(userId: string): Promise<SlackUser> {
  const result = await slack.users.info({ user: userId });
  return result.user as SlackUser;
}

export async function getSlackChannelInfo(channelId: string): Promise<SlackChannel> {
  const result = await slack.conversations.info({ channel: channelId });
  return result.channel as SlackChannel;
}

export async function getSlackChannelMembers(channelId: string): Promise<string[]> {
  const result = await slack.conversations.members({ channel: channelId });
  return result.members as string[];
}

export async function sendSlackMessage(channelId: string, message: string): Promise<void> {
  await slack.chat.postMessage({
    channel: channelId,
    text: message,
  });
}

export async function sendSlackEphemeralMessage(
  channelId: string,
  userId: string,
  message: string
): Promise<void> {
  await slack.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: message,
  });
} 
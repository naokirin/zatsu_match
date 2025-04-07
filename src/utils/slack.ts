import { WebClient } from "@slack/web-api";
import type { SlackMessage, SlackUser } from "../types/slack";
import { SlackApiError } from "./errors";

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function getSlackUserInfo(userId: string): Promise<SlackUser> {
  const result = await slack.users.info({ user: userId });
  return result.user as SlackUser;
}

export async function getSlackClient(): Promise<WebClient> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    throw new SlackApiError("Missing Slack bot token");
  }
  return new WebClient(token);
}

export async function sendSlackEphemeralMessage(
  channelId: string,
  userId: string,
  message: string | SlackMessage,
): Promise<void> {
  try {
    const client = await getSlackClient();

    const payload =
      typeof message === "string"
        ? { text: message, channel: channelId, user: userId }
        : { ...message, channel: channelId, user: userId };

    const response = await client.chat.postEphemeral(payload);

    if (!response.ok) {
      throw new SlackApiError("Failed to send ephemeral message", response);
    }
  } catch (error) {
    throw new SlackApiError("Error sending ephemeral message", error);
  }
}

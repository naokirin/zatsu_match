import { SlackEvent } from '../types/slack';
import { MatchingService } from '../services/matching/matchingService';
import { HuddleService } from '../services/huddle/huddleService';
import { getSlackChannelMembers, sendSlackMessage, sendSlackEphemeralMessage } from '../utils/slack';

const matchingService = MatchingService.getInstance();
const huddleService = HuddleService.getInstance();

interface LogContext {
  traceId: string;
  [key: string]: unknown;
}

export async function handleSlackEvent(
  event: SlackEvent,
  context: LogContext
): Promise<void> {
  const { type } = event.event;

  switch (type) {
    case 'message':
      await handleMessageEvent(event, context);
      break;
  }
}

async function handleMessageEvent(
  event: SlackEvent,
  context: LogContext
): Promise<void> {
  const { user, channel, text, bot_id } = event.event;

  // ボットからのメッセージは無視
  if (bot_id || !user || !channel || !text) return;

  // @ZatsuMatchへのメンションを処理
  const botMentionRegex = /<@[A-Z0-9]+>\s+([a-z]+)\s*(.*)/i;
  const matches = text.match(botMentionRegex);

  if (matches) {
    const subCommand = matches[1].toLowerCase();
    const args = matches[2]?.trim() || '';

    // Slackコマンドのフォーマットでハンドラーをトリガー
    const command = {
      command: '/zatsu_match',
      text: `${subCommand} ${args}`,
      user_id: user,
      channel_id: channel,
      response_url: ''
    };

    // コマンドハンドラーをインポートして呼び出し
    const { handleSlackCommand } = require('./commandHandler');
    await handleSlackCommand(command, context);
    return;
  }

  // その他のメッセージイベント処理
  console.debug('Getting channel members', { ...context, channel });
  const members = await getSlackChannelMembers(channel);

  if (members.length === 0) {
    console.warn('No members found in channel', { ...context, channel });
    return;
  }

  console.info('Matching users', { ...context, memberCount: members.length });
  const pairs = await matchingService.matchUsers(members);

  for (const [userId1, userId2] of pairs) {
    console.info('Creating huddle', { ...context, userId1, userId2 });
    await huddleService.createHuddle(userId1, userId2);
  }
} 
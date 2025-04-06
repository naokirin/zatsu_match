import { SlackEvent } from '../types/slack';
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
    default:
      console.warn('Unsupported event type', { ...context, eventType: type });
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
} 
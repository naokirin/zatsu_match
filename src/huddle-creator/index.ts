import { WebClient } from '@slack/web-api';
import { Match } from '../types/match';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export const handler = async (event: { matches: Match[] }): Promise<void> => {
  try {
    for (const match of event.matches) {
      if (match.users.length >= 2) {
        // ハドルを作成
        const result = await slack.conversations.create({
          name: `マッチングされたハドル - ${match.timestamp}`,
          is_private: true,
        });

        // チャンネルにユーザーを招待
        await slack.conversations.invite({
          channel: result.channel!.id!,
          users: match.users.join(','),
        });

        // 参加者に通知
        for (const userId of match.users) {
          await slack.chat.postMessage({
            channel: userId,
            text: `マッチングが成立しました！\n時刻: ${match.timestamp}\nハドルに参加してください。`,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}; 
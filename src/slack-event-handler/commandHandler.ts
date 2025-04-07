import { SlackCommand } from '../types/slack';
import { sendSlackEphemeralMessage } from '../utils/slack';
import {
  registerAvailability,
  getUserAvailabilities,
  deleteAvailability,
  deleteAllUserAvailabilities,
  parseTimeRange
} from '../utils/availability';
import { CommandError } from '../utils/errors';

interface LogContext {
  traceId: string;
  [key: string]: unknown;
}

export async function handleSlackCommand(
  command: SlackCommand,
  context: LogContext
): Promise<void> {
  const { command: commandName, user_id, channel_id, text } = command;
  const commandContext = { ...context, user_id, channel_id, command: commandName };

  switch (commandName) {
    case '/zatsu_match':
      await handleZatsuCommand(user_id, channel_id, text, commandContext);
      break;
    default:
      await sendSlackEphemeralMessage(
        channel_id,
        user_id,
        `Unknown command: ${commandName}`
      );
      break;
  }
}

async function handleZatsuCommand(
  userId: string,
  channelId: string,
  text: string,
  context: LogContext
): Promise<void> {
  const [subCommand, ...args] = text.trim().split(' ');

  try {
    switch (subCommand) {
      case 'register':
        await handleRegisterCommand(userId, channelId, args.join(' '), context);
        break;

      case 'list':
        await handleListCommand(userId, channelId, context);
        break;

      case 'delete':
        await handleDeleteCommand(userId, channelId, args.join(' '), context);
        break;

      default:
        throw new CommandError('無効なコマンドです。`register`, `list`, `delete` のいずれかを使用してください。');
    }
  } catch (error) {
    console.error('Error handling zatsu command', error, { ...context, subCommand });
    await sendSlackEphemeralMessage(
      channelId,
      userId,
      `エラー: ${(error as Error).message}`
    );
  }
}

async function handleRegisterCommand(
  userId: string,
  channelId: string,
  args: string,
  context: LogContext
): Promise<void> {
  // 引数のフォーマットは "2023-12-15 13:00-15:00, 2023-12-16 10:00-12:00" のような形式
  if (!args) {
    throw new CommandError('日付と時間範囲を指定してください。例: `2023-12-15 13:00-15:00`');
  }

  const timeEntries = args.split(',').map(entry => entry.trim());
  let registeredCount = 0;
  let duplicateCount = 0;

  for (const entry of timeEntries) {
    const [dateStr, timeRange] = entry.split(' ');

    if (!dateStr || !timeRange) {
      throw new CommandError(`無効な形式です: ${entry}。正しい形式は "2023-12-15 13:00-15:00" です。`);
    }

    try {
      const timestamps: string[] = parseTimeRange(dateStr, timeRange);

      // 各時間スロットを登録
      for (const timestamp of timestamps) {
        const registered = await registerAvailability(userId, timestamp, channelId);
        if (registered) {
          registeredCount++;
        } else {
          duplicateCount++;
        }
      }
    } catch (error) {
      throw new CommandError(`時間の登録に失敗しました: ${(error as Error).message}`);
    }
  }

  let message = `${registeredCount}件の空き時間を登録しました！ 🎯`;
  if (duplicateCount > 0) {
    message += `\n${duplicateCount}件の重複があり、スキップしました。`;
  }

  await sendSlackEphemeralMessage(
    channelId,
    userId,
    message
  );
}

async function handleListCommand(
  userId: string,
  channelId: string,
  context: LogContext
): Promise<void> {
  const availabilities = await getUserAvailabilities(userId);

  if (availabilities.length === 0) {
    await sendSlackEphemeralMessage(
      channelId,
      userId,
      '登録されている空き時間はありません。'
    );
    return;
  }

  // タイムスタンプで並べ替え
  const sortedAvailabilities = [...availabilities].sort(
    (a, b) => a.timestamp.localeCompare(b.timestamp)
  );

  // 日付ごとにグループ化
  const groupedByDate: Record<string, string[]> = {};

  for (const availability of sortedAvailabilities) {
    const [date, time] = availability.timestamp.split('T');

    if (!groupedByDate[date]) {
      groupedByDate[date] = [];
    }

    groupedByDate[date].push(time);
  }

  // メッセージを構成
  let message = '登録されている空き時間:\n';

  for (const date in groupedByDate) {
    const times = groupedByDate[date].map(time => {
      // 時間だけを抽出（HH:00の形式）
      const hour = time.split(':')[0];
      return `${hour}:00-${(parseInt(hour) + 1).toString().padStart(2, '0')}:00`;
    });

    message += `• ${date}: ${times.join(', ')}\n`;
  }

  await sendSlackEphemeralMessage(channelId, userId, message);
}

async function handleDeleteCommand(
  userId: string,
  channelId: string,
  args: string,
  context: LogContext
): Promise<void> {
  if (!args) {
    throw new CommandError('削除する日時または "all" を指定してください。例: `2023-12-15 13:00-15:00` または `all`');
  }

  // すべての登録を削除
  if (args.trim().toLowerCase() === 'all') {
    await deleteAllUserAvailabilities(userId);
    await sendSlackEphemeralMessage(
      channelId,
      userId,
      'すべての登録を削除しました。'
    );
    return;
  }

  // 特定の時間を削除
  const [dateStr, timeRange] = args.trim().split(' ');

  if (!dateStr || !timeRange) {
    throw new CommandError(`無効な形式です: ${args}。正しい形式は "2023-12-15 13:00-15:00" です。`);
  }

  try {
    const timestamps = parseTimeRange(dateStr, timeRange);

    // 各時間スロットを削除
    for (const timestamp of timestamps) {
      await deleteAvailability(userId, timestamp);
    }

    await sendSlackEphemeralMessage(
      channelId,
      userId,
      `${dateStr} ${timeRange} の空き時間を削除しました。`
    );
  } catch (error) {
    throw new CommandError(`時間範囲の解析に失敗しました: ${(error as Error).message}`);
  }
} 
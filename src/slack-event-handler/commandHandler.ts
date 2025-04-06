import { SlackCommand } from '../types/slack';
import { MatchingService } from '../services/matching/matchingService';
import { HuddleService } from '../services/huddle/huddleService';
import { getSlackChannelMembers, sendSlackMessage, sendSlackEphemeralMessage } from '../utils/slack';
import { Logger } from '../utils/logger';

const matchingService = MatchingService.getInstance();
const huddleService = HuddleService.getInstance();
const logger = Logger.getLogger();

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
    case '/match':
      await handleMatchCommand(channel_id, commandContext);
      break;

    case '/score':
      await handleScoreCommand(user_id, channel_id, text, commandContext);
      break;
  }
}

async function handleMatchCommand(
  channelId: string,
  context: LogContext
): Promise<void> {
  logger.debug('Getting channel members', { ...context, channelId });
  const members = await getSlackChannelMembers(channelId);

  if (members.length === 0) {
    logger.warn('No members found in channel', { ...context, channelId });
    return;
  }

  logger.info('Matching users', { ...context, memberCount: members.length });
  const pairs = await matchingService.matchUsers(members);

  for (const [userId1, userId2] of pairs) {
    logger.info('Creating huddle', { ...context, userId1, userId2 });
    await huddleService.createHuddle(userId1, userId2);
    await sendSlackMessage(
      channelId,
      `Created a huddle for <@${userId1}> and <@${userId2}>! 🎉`
    );
  }
}

async function handleScoreCommand(
  userId: string,
  channelId: string,
  text: string,
  context: LogContext
): Promise<void> {
  const score = parseInt(text);
  if (isNaN(score)) {
    logger.warn('Invalid score provided', { ...context, text });
    return;
  }

  logger.info('Updating user score', { ...context, userId, score });
  matchingService.updateUserScore(userId, score);
  await sendSlackEphemeralMessage(
    channelId,
    userId,
    `Your score has been updated to ${score}! 🎯`
  );
} 
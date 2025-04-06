import { SlackEvent } from '../types/slack';
import { MatchingService } from '../services/matching/matchingService';
import { HuddleService } from '../services/huddle/huddleService';
import { getSlackChannelMembers } from '../utils/slack';
import { Logger } from '../utils/logger';

const matchingService = MatchingService.getInstance();
const huddleService = HuddleService.getInstance();
const logger = Logger.getInstance();

interface LogContext {
  traceId: string;
  [key: string]: unknown;
}

export async function handleSlackEvent(
  event: SlackEvent,
  context: LogContext
): Promise<void> {
  const { type, user, channel } = event.event;

  switch (type) {
    case 'message':
      await handleMessageEvent(user, channel, context);
      break;
  }
}

async function handleMessageEvent(
  user: string,
  channel: string,
  context: LogContext
): Promise<void> {
  if (!user || !channel) return;

  logger.debug('Getting channel members', { ...context, channel });
  const members = await getSlackChannelMembers(channel);

  if (members.length === 0) {
    logger.warn('No members found in channel', { ...context, channel });
    return;
  }

  logger.info('Matching users', { ...context, memberCount: members.length });
  const pairs = await matchingService.matchUsers(members);

  for (const [userId1, userId2] of pairs) {
    logger.info('Creating huddle', { ...context, userId1, userId2 });
    await huddleService.createHuddle(userId1, userId2);
  }
} 
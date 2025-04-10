export interface SlackEvent {
  type: string;
  event: {
    type: string;
    user: string;
    text: string;
    channel: string;
    ts: string;
    bot_id?: string;
  };
}

export interface SlackCommand {
  command: string;
  text: string;
  user_id: string;
  channel_id: string;
  response_url: string;
}

export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackAttachment {
  [key: string]: unknown;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
  attachments?: SlackAttachment[];
}

export interface SlackUser {
  id: string;
  name: string;
  real_name: string;
  profile: {
    email?: string;
    title?: string;
  };
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
  members: string[];
}

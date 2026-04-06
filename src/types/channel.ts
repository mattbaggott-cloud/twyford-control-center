export interface Channel {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  pinned: boolean;
  archived: boolean;
}

export interface ChannelSidebarItem {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  pinned: boolean;
  sessionKey: string;
  unreadCount: number;
}

export function channelSessionKey(channelId: string): string {
  return `channel:${channelId}`;
}

export function isChannelSession(sessionKey: string): boolean {
  return sessionKey.startsWith("channel:");
}

export function channelIdFromSession(sessionKey: string): string {
  return sessionKey.replace("channel:", "");
}

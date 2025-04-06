import { SlackUser } from '../../types/slack';
import { getSlackUserInfo } from '../../utils/slack';

interface UserWithScore extends SlackUser {
  score: number;
}

export class MatchingService {
  private static instance: MatchingService;
  private userScores: Map<string, number> = new Map();

  private constructor() { }

  public static getInstance(): MatchingService {
    if (!MatchingService.instance) {
      MatchingService.instance = new MatchingService();
    }
    return MatchingService.instance;
  }

  public async matchUsers(userIds: string[]): Promise<[string, string][]> {
    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await getSlackUserInfo(userId);
        return { ...user, score: this.userScores.get(userId) || 0 };
      })
    );

    const sortedUsers = this.sortUsersByScore(users);
    return this.createPairs(sortedUsers);
  }

  private sortUsersByScore(users: UserWithScore[]): UserWithScore[] {
    return [...users].sort((a, b) => b.score - a.score);
  }

  private createPairs(users: UserWithScore[]): [string, string][] {
    const pairs: [string, string][] = [];
    for (let i = 0; i < users.length - 1; i += 2) {
      pairs.push([users[i].id, users[i + 1].id]);
    }
    return pairs;
  }

  public updateUserScore(userId: string, score: number): void {
    this.userScores.set(userId, score);
  }

  public getUserScore(userId: string): number {
    return this.userScores.get(userId) || 0;
  }
} 
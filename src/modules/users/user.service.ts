import { User } from "@prisma/client";

import { env } from "../../config/env";
import { UserRepository } from "./user.repository";

export interface SyncTelegramUserInput {
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
}

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async syncTelegramUser(input: SyncTelegramUserInput): Promise<User> {
    return this.userRepository.upsertTelegramUser({
      telegramId: input.telegramId,
      username: input.username,
      firstName: input.firstName,
      timezone: env.DEFAULT_TIMEZONE,
    });
  }

  async getUserByTelegramId(telegramId: string): Promise<User | null> {
    return this.userRepository.findByTelegramId(telegramId);
  }

  async getUserById(userId: string): Promise<User | null> {
    return this.userRepository.findById(userId);
  }

  async updateDailySummarySettings(
    userId: string,
    input: {
      enabled?: boolean;
      timeMinutes?: number | null;
      lastSentAt?: Date | null;
      promptedAt?: Date;
    },
  ): Promise<User> {
    return this.userRepository.updateDailySummarySettings(userId, input);
  }

  async listUsersDueForDailySummary(timeMinutes: number, dayStart: Date): Promise<User[]> {
    return this.userRepository.listUsersDueForDailySummary(timeMinutes, dayStart);
  }

  async listUsersForSummary(frequency: "daily" | "weekly"): Promise<User[]> {
    return this.userRepository.listUsersForSummary(frequency);
  }
}

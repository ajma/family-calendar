import { Request } from 'express';
import { CalendarConfig, Person } from '../src/types';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
  };
}

export interface UserSettings {
  calendarConfigs: Record<string, CalendarConfig>;
  people: Person[];
}

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
}

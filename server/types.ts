import { Request } from "express";
import { CalendarConfig, Person, Appearance } from "../common/types";

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
  };
}

export interface UserSettings {
  calendarConfigs: Record<string, CalendarConfig>;
  people: Person[];
  appearance: Appearance;
}

export interface StoredTokens {
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiry: number | null;
}

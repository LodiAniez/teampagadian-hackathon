import { api } from "../api";

export type Money = {
  amount: number;
  currency: string;
};

export type Bir2303Election = "8_percent" | "graduated";

export type MeResponse = {
  id: string;
  phone: string;
  name: string | null;
  businessName: string | null;
  defaultCurrency: string;
  defaultHourlyRate: Money | null;
  bir2303Election: Bir2303Election | null;
  createdAt: string;
  updatedAt: string;
};

export const authService = {
  me: async() => await api.get<MeResponse>("/auth/me"),
  logout: async() => await api.post("/auth/logout", {}, { skipAuth: false }),
};
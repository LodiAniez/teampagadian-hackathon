import { MeResponse } from "../lib/services/auth.service";


export type AuthContext = {
  user: MeResponse | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};
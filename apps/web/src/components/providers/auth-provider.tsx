type User = {
  id: string;
  email?: string | null;
  name?: string | null;
};

type AuthContext = {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
};
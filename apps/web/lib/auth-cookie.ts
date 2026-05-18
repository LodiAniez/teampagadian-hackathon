import Cookies from "js-cookie";

const TOKEN_KEY = "access_token" as const;

export const setToken = (token: string) => {
  Cookies.set(TOKEN_KEY, token, {
    expires: 7,
    secure: true,
    sameSite: "strict",
  });
};

export const getToken = () => Cookies.get(TOKEN_KEY);

export const clearToken = () => Cookies.remove(TOKEN_KEY);
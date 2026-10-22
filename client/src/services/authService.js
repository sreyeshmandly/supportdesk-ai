import api from "./api";

export const authService = {
  async login(credentials) {
    const { data } = await api.post("/auth/login", credentials);
    return data;
  },
  async register(details) {
    const { data } = await api.post("/auth/register", details);
    return data;
  },
  async me() {
    const { data } = await api.get("/auth/me");
    return data;
  }
};

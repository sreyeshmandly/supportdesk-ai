import api from "./api";

export const ticketService = {
  async list(params = {}) {
    const { data } = await api.get("/tickets", { params });
    return data;
  },
  async get(id) {
    const { data } = await api.get(`/tickets/${id}`);
    return data;
  },
  async create(payload) {
    const { data } = await api.post("/tickets", payload);
    return data;
  },
  async addMessage(id, payload) {
    const { data } = await api.post(`/tickets/${id}/messages`, payload);
    return data;
  },
  async update(id, payload) {
    const { data } = await api.patch(`/tickets/${id}`, payload);
    return data;
  }
};

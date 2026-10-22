import api from "./api";

export const knowledgeBaseService = {
  async list() {
    const { data } = await api.get("/knowledge-base");
    return data.articles || [];
  },
  async get(id) {
    const { data } = await api.get(`/knowledge-base/${id}`);
    return data.article;
  },
  async create(payload) {
    const { data } = await api.post("/knowledge-base", payload);
    return data;
  },
  async update(id, payload) {
    const { data } = await api.patch(`/knowledge-base/${id}`, payload);
    return data;
  },
  async publish(id) {
    const { data } = await api.post(`/knowledge-base/${id}/publish`);
    return data;
  },
  async ask(question) {
    const { data } = await api.post("/knowledge-base/ask", { question });
    return data;
  }
};

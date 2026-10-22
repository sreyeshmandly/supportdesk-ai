import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api",
  timeout: 20000,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("supportdesk_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("supportdesk_token")) {
      localStorage.removeItem("supportdesk_token");
      localStorage.removeItem("supportdesk_user");
      window.dispatchEvent(new Event("supportdesk:session-expired"));
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const data = error?.response?.data;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  if (Array.isArray(data?.issues) && data.issues.length) return data.issues[0].message;
  if (error?.code === "ECONNABORTED") return "The request took too long. Please try again.";
  if (!error?.response) return "Cannot reach the API. Check that the backend is running.";
  return fallback;
}

export default api;

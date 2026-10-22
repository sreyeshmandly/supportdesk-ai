import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Tickets from "./pages/tickets/Tickets";
import CreateTicket from "./pages/tickets/CreateTicket";
import TicketDetails from "./pages/tickets/TicketDetails";
import KnowledgeBase from "./pages/knowledge-base/KnowledgeBase";
import ArticleEditor from "./pages/knowledge-base/ArticleEditor";
import ArticleDetails from "./pages/knowledge-base/ArticleDetails";
import AIAssistant from "./pages/ai-assistant/AIAssistant";
import Users from "./pages/users/Users";
import Profile from "./pages/profile/Profile";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<CreateTicket />} />
          <Route path="/tickets/:id" element={<TicketDetails />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/knowledge-base/new" element={<ArticleEditor />} />
          <Route path="/knowledge-base/:id" element={<ArticleDetails />} />
          <Route path="/knowledge-base/:id/edit" element={<ArticleEditor />} />
          <Route path="/ai-assistant" element={<AIAssistant />} />
          <Route path="/users" element={<Users />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}

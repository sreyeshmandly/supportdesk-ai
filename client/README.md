# SupportDesk AI Pro — Frontend

React + Vite + JavaScript + Axios + React Router + Context API + CSS Modules.

## Setup

1. Copy these files into the existing `C:\projects\supportdesk-ai-pro\client` directory.
2. Open a terminal in `client`.
3. Run `npm install`.
4. Copy `.env.example` to `.env`.
5. Run `npm run dev`.
6. Open `http://localhost:5173`.

The backend must be running at `http://localhost:4000`, with its existing database, Redis, and environment configuration set up.

## Available screens

- Login and organization registration
- Dashboard
- Ticket list, ticket creation, ticket details, replies, status changes, assignment
- Knowledge base article list, creation, editing, publishing
- Gemini RAG assistant with source article references
- Organization user list and user creation (admin only)
- Profile

## Notes

- This frontend uses the existing Express API; it does not replace backend security or validation.
- The ticket list endpoint currently returns a paginated list without a total count. Dashboard summaries therefore describe the tickets fetched for the current view, not the entire database.
- The existing ticket detail endpoint returns `triage_status`, `category`, and `priority`. The current API does not expose the saved `ai_suggestions` payload, so the UI does not pretend to display sentiment or confidence values it cannot retrieve.
- A customer can only see the records allowed by the backend. UI route restrictions are for navigation and usability; backend authorization remains authoritative.
- The token is stored in localStorage to match the current JWT API. For production, consider a backend-supported secure, HttpOnly cookie strategy and a security review.

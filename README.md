<div align="center">

# SupportDesk AI Pro

### AI-Powered, Multi-Tenant Customer Support Platform

A full-stack helpdesk application with secure ticket management, asynchronous AI ticket triage, and knowledge-base question answering powered by Retrieval-Augmented Generation (RAG).

**Built with React · Node.js · Express · MySQL · Redis · BullMQ · Google Gemini**

[Features](#-features) · [Screenshots](#-application-walkthrough) · [Architecture](#-architecture) · [Setup](#-run-locally) · [Testing](#-testing)

</div>

---

## 📌 Project Overview

SupportDesk AI Pro is a multi-tenant customer support system designed to help support teams manage tickets and answer customer questions using organization-specific knowledge.

It combines a React frontend and Express REST API with MySQL persistence, Redis-backed background jobs, and Google Gemini for AI-powered ticket classification and RAG-based answers.

### The problem it addresses

Support teams need to organize incoming requests, identify urgent issues, keep customer conversations private, and find accurate answers from support documentation. This project brings those workflows into one application and adds AI assistance while retaining authorization and organization boundaries.

## ✨ Features

### 🔐 Authentication and authorization
- JWT-based authentication and password hashing.
- Role-based access for supported user roles.
- Protected API routes.
- Organization-aware access checks.

### 🎫 Ticket management
- Create, list, and view support tickets.
- Track ticket status, category, priority, assignee, and SLA deadline.
- Maintain ticket conversations.
- Support public replies and staff-only internal notes.
- Validate status transitions and staff assignments.
- Restrict customer access to their own tickets.

### 🤖 Asynchronous AI ticket triage
- Classify ticket content with Google Gemini.
- Generate category, priority, sentiment, and confidence information.
- Validate structured model output before saving it.
- Queue work using BullMQ and Redis instead of waiting for AI processing during ticket creation.
- Retry failed jobs and recover eligible pending jobs.
- Persist triage suggestions and status in MySQL.

### 📚 Knowledge-base management
- Create and update knowledge-base articles.
- Keep new articles in draft status until published.
- Chunk published content and generate embeddings.
- Store article chunks and embeddings in MySQL.
- Rebuild indexed chunks when published content changes.

### 🔎 Retrieval-Augmented Generation (RAG)
- Embed user questions using a Gemini embedding model.
- Retrieve semantically relevant chunks from published knowledge-base articles.
- Scope retrieval to the authenticated user's organization.
- Generate answers using retrieved source content.
- Return source metadata with answers.
- Return a safe fallback when no relevant knowledge-base chunks are retrieved.
- Instruct the LLM to acknowledge missing information instead of inventing policies or facts.

### 🛡️ Security and reliability
- Organization-scoped ticket and knowledge-base operations.
- Customer restrictions for ticket ownership and internal notes.
- Request validation with Zod.
- Security middleware and configured CORS.
- Automated backend tests.

> AI-generated classifications and answers can be incorrect. Review important decisions and evaluate RAG answers against the source articles before using the system for real customer support.

## 🖥️ Application Walkthrough

The screenshots below are intended to show the **actual running application**. Add your own screenshots to `docs/screenshots/` using the filenames listed here. Until those files are added, GitHub will display broken image placeholders for the corresponding entries.

### 1. Login

The user opens the application and signs in with a valid account.

![SupportDesk AI Pro login screen](docs/screenshots/01-login.png)

### 2. Dashboard

After authentication, the user lands on the dashboard and can navigate to the application's available sections.

![SupportDesk AI Pro dashboard](docs/screenshots/02-dashboard.png)

### 3. Ticket list

The ticket list provides access to the support requests available to the signed-in user.

![SupportDesk AI Pro ticket list](docs/screenshots/03-ticket-list.png)

### 4. Create a ticket

A customer submits a ticket with a subject and description. The API saves the ticket and attempts to enqueue AI triage.

![SupportDesk AI Pro create ticket screen](docs/screenshots/04-create-ticket.png)

### 5. Ticket details and conversation



### 6. Start Redis and the triage worker

Ensure Redis is running and reachable with the configured connection details. Open another terminal:

```powershell
Set-Location .\server
npm run worker
```

The worker is required for asynchronous ticket triage. Ticket creation may still succeed if queueing fails, but the job will not be processed until the queue and worker are healthy.

### 7. Start the frontend

Open another terminal:

```powershell
Set-Location .\client
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

### 8. Verify the workflow

1. Sign in with a valid account.
2. Open the dashboard and navigate through the available sections.
3. Create a support ticket.
4. Check that the ticket appears in the ticket list.
5. Confirm that triage is queued and processed by the worker.
6. Open the ticket and test the conversation workflow.
7. As an authorized staff user, create and publish a knowledge-base article.
8. Ask a question answered by that article.
9. Ask a question not covered by the article and check that the response acknowledges the missing information.
10. Test that users from another organization cannot access the ticket or knowledge-base content.

The application requires a configured MySQL database, Redis, valid Gemini access, and suitable test data for these workflows.

## 🔌 API Overview

The Express application registers these main route groups:

| Route | Purpose |
|---|---|
| `GET /health` | Health endpoint |
| `/api/auth` | Authentication |
| `/api/users` | User management |
| `/api/tickets` | Ticket and conversation operations |
| `/api/knowledge-base` | Knowledge-base operations and RAG |

### RAG endpoint

```http
POST /api/knowledge-base/ask
Content-Type: application/json
Authorization: Bearer <token>
```

Request:

```json
{
  "question": "What information is required to request a refund?"
}
```

The endpoint uses the authenticated user's organization. It returns an answer and source metadata when available. Refer to the route implementation for the exact response schema and authorization behavior.

## 🗄️ Database

MySQL stores application records and RAG embeddings. The schema includes the main entities for organizations, users, tickets, ticket messages, knowledge-base articles, article chunks, and AI suggestions.

- Base schema: `database/schema.sql`
- Additional migrations: inspect the `database/` directory and apply them in order.

Back up important databases before making schema changes.

## 🧪 Testing

### Backend automated tests

From the `server` directory:

```powershell
npm test -- --runInBand
```

### Frontend production build

From the `client` directory:

```powershell
npm run build
```

### Latest recorded verification

On October 23, 2026, the development environment reported:

- **7 backend test suites passed**
- **72 backend tests passed**
- **Vite production build passed**
- **1,665 frontend modules transformed**

These results describe that recorded run. Re-run the checks after making code changes.

## 🔒 Security Notes

- Keep `.env` files and credentials out of version control.
- Use a strong, unique `JWT_SECRET` in every deployed environment.
- Use least-privilege MySQL credentials.
- Restrict CORS to the expected frontend origin.
- Use HTTPS in production.
- Keep test data separate from real customer data.
- Verify tenant isolation and role permissions before deployment.
- Treat AI outputs as suggestions and review important decisions.
- Avoid including tokens, secrets, or real customer data in screenshots and logs.

## 🚢 Deployment Checklist

Deployment is environment-specific; no live deployment is claimed by this README.

Before deployment, verify:

- [ ] A production frontend API URL is configured.
- [ ] Backend CORS allows only the deployed frontend origin.
- [ ] Production MySQL schema and migrations are applied.
- [ ] Redis is available to the worker.
- [ ] Gemini API access and model names are valid.
- [ ] Secrets are configured through the hosting provider's environment settings.
- [ ] Frontend build succeeds.
- [ ] Backend tests pass.
- [ ] Authentication, tenant isolation, ticket workflow, and RAG are tested end-to-end.
- [ ] Database backups and basic monitoring are configured.

## 🗺️ Possible Future Improvements

These are optional ideas, not claims that they are currently implemented:

- More comprehensive end-to-end tests.
- Monitoring and operational dashboards for background jobs.
- Ticket analytics and reporting.
- Email notifications.
- Audit logs for sensitive staff actions.
- Expanded RAG retrieval and grounded-answer evaluation.
- Production deployment automation.

## 👨‍💻 Author

**Sreyesh Mandly**

- GitHub: [@sreyeshmandly](https://github.com/sreyeshmandly)
- Project repository: [sreyeshmandly/supportdesk-ai](https://github.com/sreyeshmandly/supportdesk-ai)

## 📄 License

No license has been specified here. Add a `LICENSE` file and update this section if you intend to grant others permission to reuse or distribute the project.

---

<div align="center">

**SupportDesk AI Pro**  
*Secure ticket management, asynchronous AI triage, and knowledge-grounded support.*

</div>

## 🖥️ Application Walkthrough

The following walkthrough demonstrates the main workflows available in SupportDesk AI Pro, from authentication and ticket management to knowledge-base administration, grounded AI question answering, and team management.

### 1. Login

Users sign in with their registered credentials to access the workspace.

![SupportDesk AI Pro login screen](docs/screenshots/01-login.png)

### 2. Dashboard

After authentication, users arrive at the dashboard and can navigate to the application's available sections.

![SupportDesk AI Pro dashboard](docs/screenshots/02-dashboard.png)

### 3. Ticket Management

The Tickets section allows users to access support requests and follow their status. Ticket details include the original request, conversation history, and available ticket information.

![SupportDesk AI Pro ticket list](docs/screenshots/03-ticket-list.png)

### 4. Knowledge Base

The Knowledge Base provides a shared location for support policies and procedural documentation.

Authorized staff can create articles, save drafts, and publish approved content. Published articles are indexed through the existing Gemini embedding workflow so that their content can be retrieved by the AI assistant.

The page also provides an **Ask AI** area for asking questions grounded in published knowledge-base articles.

![SupportDesk AI Pro knowledge base](docs/screenshots/07-knowledge-base.png)

### 5. AI Knowledge Assistant

The AI Assistant lets users ask questions about support policies, processes, and workflows.

The application retrieves relevant chunks from published knowledge-base articles belonging to the user's organization and uses Google Gemini to generate a grounded response. Source references are provided when relevant knowledge is available.

The interface also explains the retrieval-augmented generation (RAG) workflow:

1. **Search your knowledge:** Retrieve relevant chunks from published articles in the organization.
2. **Generate a grounded response:** Use the retrieved content as context for the Gemini response.
3. **Review the sources:** Check the source references and relevance before relying on the answer.

Example questions include:

* What is the refund verification process?
* How long does an approved refund take?
* What should I include when escalating a support issue?

Answers may be incomplete when the published knowledge base does not contain the required information. Important decisions should be checked against official policies.

![SupportDesk AI Pro AI knowledge assistant](docs/screenshots/08-rag-answer.png)

### 6. Team Members

The Team Members section provides organization-level administration for viewing team members and their assigned roles.

The demonstrated workspace includes an admin account and agent accounts. This section helps illustrate how support operations are organized within the application.

![SupportDesk AI Pro team members](docs/screenshots/10-team-members.png)

### 7. Ticket Details and Conversation

The ticket details page displays the original customer request, ticket status, and conversation messages.

Support agents can respond to customers through public replies. The interface also supports an internal-note option for staff communication, which is intended to remain hidden from customers.

![SupportDesk AI Pro ticket details](docs/screenshots/05-ticket-details.png)

### 8. AI Ticket Triage

Ticket creation can enqueue an asynchronous AI triage job. The background worker processes the job and saves the classification results to MySQL.

The ticket can display its saved category, priority, and triage status after processing.

![SupportDesk AI Pro AI ticket triage](docs/screenshots/06-ai-triage.png)

### 9. Create a Ticket

Customers can submit a support request with a subject and description. The API saves the ticket and attempts to enqueue the AI triage job.

The ticket can be created even when queueing fails; in that case, the AI job requires separate recovery or retry.

![SupportDesk AI Pro create ticket screen](docs/screenshots/04-create-ticket.png)

### 10. Automated Test Results

Backend tests and the frontend production build provide development-time checks for the application's behavior and build configuration.

The recorded development verification reported seven passing backend test suites, 72 passing backend tests, and a successful Vite production build. These are recorded results, not a guarantee that every workflow has been tested end-to-end.

![SupportDesk AI Pro test results](docs/screenshots/09-test-results.png)

### Screenshot Instructions

To complete this walkthrough:

1. Run the application locally.
2. Open each implemented page in your browser.
3. Capture the actual screen using Windows Snipping Tool (`Win + Shift + S`).
4. Save each PNG in `docs/screenshots/` using the exact filename referenced above.
5. Check that each image displays correctly in the GitHub README preview.
6. Commit the screenshots and README changes to the `main` branch.

Do not include passwords, API keys, authentication tokens, or private customer information in screenshots. Only include screenshots of features that are actually implemented and working.

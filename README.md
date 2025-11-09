# mongodb-chatgpt-sdk-demo

**mongodb-chatgpt-sdk-demo** is a Next.js 15 starter that shows how to pair [MongoDB Atlas](https://www.mongodb.com/atlas), Vercel, and the [ChatGPT Apps SDK](https://platform.openai.com/docs/apps) to build a collaborative to-do assistant. The same Atlas-backed APIs drive both the traditional web UI and the Model Context Protocol (MCP) tools that make the experience available directly inside ChatGPT.

![Demo](./ChatGPT-mcp-app.gif)
## Highlights

- **Shared task lists.** `todo_lists` and `todo_items` collections live in Atlas, complete with optimistic UI updates, sharing links, and live refresh via SWR.
- **Zero-friction local dev.** `lib/mongodb.ts` drops into an in-memory store when `MONGODB_URI` is unset, so you can demo without a network connection and switch to Atlas by setting one env variable.
- **ChatGPT-native tooling.** `/api/mcp/[transport]/route.ts` registers widget HTML plus tools for creating, listing, updating, and deleting todos so ChatGPT can talk to the exact same backend.
- **One deployment path.** Vercel hosts the app, serves the widget template, and exposes the MCP endpoint you plug into ChatGPT’s “Develop your own” flow.

## Project structure

```
app/
  api/
    mcp/[transport]/route.ts   # MCP handler (JSON/SSE transports)
    todos/[listId]/route.ts    # REST API for CRUD actions
  todos/                       # Pages + widgets for list display
components/
  todo-list-widget.tsx         # Main React UI with optimistic updates
lib/
  mongodb.ts                   # Atlas client + in-memory fallback
  openai.ts                    # Widget helper (window.openai bridge)
```

## Prerequisites

- Node.js 20+
- Package manager (pnpm recommended)
- MongoDB Atlas cluster (M0 free tier works) or a local MongoDB for testing
- Optional: Ngrok if you want to test the MCP endpoint from ChatGPT while running locally (`pnpm ngrok`)

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Copy `.env.example` (or use the snippet below) into `.env` and fill in your MongoDB connection string:

   ```bash
   MONGODB_URI="mongodb+srv://<user>:<password>@cluster.mongodb.net/chatgpt_todos"
   ```

3. (Optional) Seed the database:

   ```js
   use chatgpt_todos
   db.todo_lists.insertOne({ _id: "launch-list", title: "Launch checklist", shareToken: UUID(), createdAt: new Date() })
   ```

## Local development

```bash
pnpm dev
```

- App: http://localhost:3000
- Todo API: http://localhost:3000/api/todos/:listId
- MCP endpoint (JSON transport): http://localhost:3000/api/mcp/json

Because `lib/mongodb.ts` falls back to an in-memory store when `MONGODB_URI` is absent, you can explore the UI and MCP tools even without a live database.

## ChatGPT Apps SDK integration

The MCP route (`app/mcp/route.ts`) performs three jobs:

1. Renders the `/todos/widget` page once and registers it as a widget resource so ChatGPT can embed the exact same UI.
2. Exposes tools (`create_todo_list`, `add_todo_item`, `complete_todo_item`, `delete_todo_item`, `get_todo_list`, `list_todo_lists`, `upsert_todo_items`) with `zod`-validated inputs.
3. Returns both human-readable text and `structuredContent` so the widget stays in sync after each tool call.

To try it inside ChatGPT:

1. Run the dev server (or deploy to Vercel).
2. In ChatGPT, open **Build a GPT → Add Actions → Model Context Protocol**.
3. Paste `https://<your-domain>/api/mcp/json` (or your ngrok URL).
4. ChatGPT detects the tools automatically; click **Save** and start prompting with phrases like “Create a project launch list and add three tasks.”

## Deployment on Vercel

1. Push the repo to GitHub and import it into Vercel.
2. Set environment variables (`MONGODB_URI`, plus optional `PUBLIC_BASE_URL` if you need a custom domain).
3. Deploy. `baseUrl.ts` auto-detects the correct origin for widget CSP metadata, so the MCP registration works out of the box.
4. Update your ChatGPT MCP configuration to use the production URL.

## Scripts

| Script      | Description                                             |
| ----------- | ------------------------------------------------------- |
| `pnpm dev`  | Run Next.js with Turbopack                              |
| `pnpm build`| Create the production bundle                            |
| `pnpm start`| Launch the production server locally                    |
| `pnpm ngrok`| Expose port 3000 via ngrok for ChatGPT MCP testing      |

## Troubleshooting

- **In-memory fallback instead of Atlas?** Ensure `MONGODB_URI` is defined in the environment for both local dev and Vercel.
- **Widget not loading in ChatGPT?** Verify the CSP metadata in `app/mcp/route.ts` references the correct domain—setting `PUBLIC_BASE_URL` fixes custom setups.
- **Tool calls stuck?** Check Vercel function logs or `pnpm dev` output; look for `[todos]` or `[v0]` logs from the API routes.

## License

This project is provided as an educational sample. Adapt it freely for demos, blog posts, or your own ChatGPT-enabled apps.

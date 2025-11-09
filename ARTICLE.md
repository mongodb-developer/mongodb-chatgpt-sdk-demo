# Todos That Ship Themselves: MongoDB Atlas + Vercel + ChatGPT Apps SDK

[MongoDB Atlas](https://www.mongodb.com/atlas) turns everyday data into a launchpad for generative AI workflows. Pair it with Vercel’s serverless edge and OpenAI’s new [ChatGPT Apps SDK](https://platform.openai.com/docs/apps) and even a humble to-do list can become a collaborative assistant that lives wherever your users are. We built **chatgpt-todo-mcp** during MongoDB.local NYC to show how little friction it takes: spin up Atlas, drop the connection string into a Next.js app, and distribute a shareable list manager straight through ChatGPT. It feels less like “writing yet another CRUD app” and more like shipping a co-worker that never misses a checkbox.

## Why MongoDB Atlas Anchors ChatGPT Apps

- **Flexible documents for human-shaped data.** Tasks come with free-form text, completion state, ordering, and sharing metadata. Atlas stores it all in a single document without forcing you into rigid schemas.
- **Scales with serverless traffic.** Atlas connection pooling keeps Vercel function cold starts low while auto-scaling handles usage spikes from popular GPTs.
- **Productivity-friendly safety net.** Need to demo offline? `lib/mongodb.ts` slips into an in-memory store when `MONGODB_URI` is missing, so you can prototype locally and swap to Atlas when you’re ready.
- **Secrets that stay server-side.** Environment variables on Vercel map cleanly to Atlas credentials, ensuring ChatGPT widgets never leak database access to the browser.
- **Observability baked in.** Atlas’ metrics, query profiler, and triggers let you watch your GPT’s behavior evolve without bolting on extra tooling.

## The App in a Nutshell

`chatgpt-todo-mcp` is a Next.js 14 project that exposes a single, relatable capability: managing shared task lists. Lists live in two Atlas collections—`todo_lists` for metadata and `todo_items` for the work itself—while a polished React widget keeps everyone in sync, whether they open the Vercel page or summon the tool inside ChatGPT. The same backend routes serve both experiences, so once you deploy to Vercel, the ChatGPT App SDK can reuse the exact infrastructure. It is the classic “single source of truth” story, except your truth now answers spoken prompts.

![ChatGPT Todo MCP demo](images/ChatGPT-mcp-app.gif)

## Tutorial: Launch the Todo Assistant Yourself

> You’ll need a MongoDB Atlas cluster (M0 is plenty), Node.js 20+, a Vercel project, and access to ChatGPT’s “Develop your own” experience. Expect to bounce between the Atlas UI, your favorite terminal, and the ChatGPT builder tab—it’s a tight loop that keeps momentum high.

### 1. Create the Dataset in Atlas

1. Spin up an Atlas project and cluster, then open the **Collections** tab.
2. Add a database named `chatgpt_todos` with two collections: `todo_lists` and `todo_items`.
3. Seed your first list with `mongosh` or the Atlas Data Importer:

```javascript
use chatgpt_todos
db.todo_lists.insertOne({
  title: "Launch checklist",
  shareToken: crypto.randomUUID(),
  createdAt: new Date()
})
```

Keep the connection string handy—you’ll paste it into the app shortly.

### 2. Wire Next.js to Atlas (and Keep Local Dev Easy)

The project’s `lib/mongodb.ts` centralizes the connection logic and quietly falls back to a memory store if you haven’t provided `MONGODB_URI`. That means local demos stay fast while production reads straight from Atlas:

```ts
// lib/mongodb.ts
const uri = process.env.MONGODB_URI || "mongodb://localhost:27017"
const options = { maxPoolSize: 10, minPoolSize: 1, maxIdleTimeMS: 30000 }

if (!useMemoryStore) {
  client = new MongoClient(uri, options)
  clientPromise = client.connect()
}

export async function getDatabase(): Promise<Db | MemoryDb> {
  try {
    const client = await clientPromise
    return client.db("chatgpt_todos")
  } catch (error) {
    console.error("Failed to connect to MongoDB, falling back to in-memory store", error)
    return getMemoryDb()
  }
}
```

Drop your Atlas URI into `.env` as `MONGODB_URI`, restart the dev server, and the same API calls now persist to the cloud.

### 3. Build CRUD APIs That ChatGPT and the UI Share

All list interactions flow through `app/api/todos/[listId]/route.ts`. The GET handler fetches the list and its items, while POST branches on an `action` field to add, toggle, or delete tasks:

```ts
// app/api/todos/[listId]/route.ts
const items = await db
  .collection("todo_items")
  .find({ listId: new ObjectId(listId) })
  .sort({ order: 1 })
  .toArray()

switch (action) {
  case "add":
    await db.collection("todo_items").insertOne({
      listId: new ObjectId(listId),
      text,
      completed: false,
      order: itemsCount,
      createdAt: new Date(),
    })
    break
  case "toggle":
    await db.collection("todo_items").updateOne(
      { _id: new ObjectId(itemId), listId: new ObjectId(listId) },
      { $set: { completed } },
    )
    break
  case "delete":
    await db.collection("todo_items").deleteOne({ _id: new ObjectId(itemId), listId: new ObjectId(listId) })
    break
}
```

Because Atlas handles concurrent writes and ordering, ChatGPT can queue new tasks and see the updated list in one round trip.

### 4. Craft the Shared UI and ChatGPT Widget

`components/todo-list-widget.tsx` is the heart of the user experience. It renders the list, performs optimistic updates, and keeps the browser and Atlas in sync:

```tsx
// components/todo-list-widget.tsx
const optimisticItem = {
  id: "temp-" + Date.now(),
  text: newItemText,
  completed: false,
  order: items.length,
}
mutate({ ...data, items: [...items, optimisticItem] }, false)
await fetch(`/api/todos/${listId}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "add", text: newItemText }),
})
```

When the same widget runs inside ChatGPT (see `app/todos/widget/page.tsx`), it listens for tool invocations and routes user actions back through the App SDK:

```tsx
// app/todos/widget/page.tsx
if (window?.openai?.callTool) {
  window.openai.callTool("add_todo_item", {
    listId: data.listId,
    text: newItemText,
  })
}
```

That bridge is what lets a user say “Add ‘order swag’ to the launch checklist” in ChatGPT and watch the Vercel-hosted UI update in real time.

### 5. Hand the Controls to ChatGPT via the MCP Route

`app/mcp/route.ts` is where the ChatGPT Apps SDK plugs in. The handler renders the widget HTML once, registers it as a resource, and then lists every tool ChatGPT can call—create, add, complete, delete, fetch, list, and even bulk upsert items—all backed by Atlas:

```ts
// app/mcp/route.ts
const handler = createMcpHandler(async (server) => {
  const html = await getAppsSdkCompatibleHtml(baseURL, "/todos/widget")

  server.registerTool(
    "create_todo_list",
    { title: "Create Todo List", inputSchema: { title: z.string().min(1) }, _meta: widgetMeta(todoWidget) },
    async ({ title }) => {
      const { db } = await connectToDatabase()
      const listId = nanoid()
      await db.collection("todo_lists").insertOne({ _id: listId, title, shareToken: nanoid(16), createdAt: new Date() })
      return { structuredContent: { listId, title, items: [] }, _meta: widgetMeta(todoWidget) }
    },
  )
})
```

Every other tool follows the same pattern: validate input with `zod`, hit Atlas through `connectToDatabase`, and return both human-readable text and structured content so the ChatGPT UI knows how to render the latest list. Because the widget HTML is cached and served from `/todos/widget`, the ChatGPT experience looks indistinguishable from the Vercel site.

### 6. Deploy to Vercel and Register the Tool

1. Push the repo to GitHub, then import it into Vercel.
2. Add `MONGODB_URI` (and any sharing tokens you want to pre-seed) under **Environment Variables**.
3. Deploy—the app auto-detects its public URL through `baseUrl.ts`, so the Model Context Protocol endpoints advertise the proper origin.
4. In ChatGPT, open **Build a GPT → Add Actions → Model Context Protocol** inside the [ChatGPT Apps SDK](https://platform.openai.com/docs/apps) workflow and point it at `https://<your-app>.vercel.app/api/mcp/json`. Populate the tool list with the Todo operations, reload ChatGPT, and you’re ready to collaborate with your new assistant.

## Field Notes Before You Ship

- Use [MongoDB Atlas](https://www.mongodb.com/atlas) Performance Advisor to spot hot queries as your GPT gains users; it will recommend indexes for large task boards.
- Consider a capped “activity” collection to log completions—Atlas Triggers can fan those events out to Slack or Vercel Realtime.
- Keep environment variables organized per environment in Vercel. Atlas makes it easy to create separate users for preview, staging, and production so you never test with live data.

## What’s Next

With the plumbing finished, swap in your own collections—daily standups, customer onboarding tasks, or any workflow that benefits from a conversational front door. [MongoDB Atlas](https://www.mongodb.com/atlas) gives you a forever-on source of truth, Vercel ships the experience worldwide, and the [ChatGPT Apps SDK](https://platform.openai.com/docs/apps) turns it into a tool teams can summon on demand. That combination makes “let’s just build it” a realistic answer, even on conference wifi.

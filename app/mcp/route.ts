import { baseURL } from "@/baseUrl"
import { createMcpHandler } from "mcp-handler"
import { connectToDatabase } from "@/lib/mongodb"
import { nanoid } from "nanoid"
import { z } from "zod"

const getAppsSdkCompatibleHtml = async (baseUrl: string, path: string) => {
  const result = await fetch(`${baseUrl}${path}`)
  return await result.text()
}

type ContentWidget = {
  id: string
  title: string
  templateUri: string
  invoking: string
  invoked: string
  html: string
  description: string
}

const DEFAULT_SECURITY_SCHEMES = [{ type: "noauth" as const }]

function widgetMeta(widget: ContentWidget) {
  return {
    securitySchemes: DEFAULT_SECURITY_SCHEMES,
    "openai/outputTemplate": widget.templateUri,
    "openai/toolInvocation/invoking": widget.invoking,
    "openai/toolInvocation/invoked": widget.invoked,
    "openai/widgetAccessible": false,
    "openai/resultCanProduceWidget": true,
  } as const
}

const handler = createMcpHandler(async (server) => {
  // Fetch the widget HTML
  const html = await getAppsSdkCompatibleHtml(baseURL, "/todos/widget")
  const widgetOrigin = new URL(baseURL).origin

  const todoWidget: ContentWidget = {
    id: "show_todos",
    title: "Show Todo List",
    templateUri: "ui://widget/todo-list.html",
    invoking: "Loading todo list...",
    invoked: "Todo list loaded",
    html: html,
    description: "Displays an interactive todo list",
  }

  // Register the widget resource
  server.registerResource(
    "todo-widget",
    todoWidget.templateUri,
    {
      title: todoWidget.title,
      description: todoWidget.description,
      mimeType: "text/html+skybridge",
      _meta: {
        "openai/widgetDescription": todoWidget.description,
        "openai/widgetPrefersBorder": true,
        "openai/widgetCSP": {
          connect_domains: [widgetOrigin],
          resource_domains: [widgetOrigin],
        },
        "openai/widgetDomain": widgetOrigin,
      },
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: `<html>${todoWidget.html}</html>`,
          _meta: {
            "openai/widgetDescription": todoWidget.description,
            "openai/widgetPrefersBorder": true,
            "openai/widgetCSP": {
              connect_domains: [widgetOrigin],
              resource_domains: [widgetOrigin],
            },
            "openai/widgetDomain": widgetOrigin,
          },
        },
      ],
    }),
  )

  // Register create_todo_list tool
  server.registerTool(
    "create_todo_list",
    {
      title: "Create Todo List",
      description: "Create a new todo list with a title",
      inputSchema: {
        title: z.string().min(1).describe("The title of the todo list"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      _meta: widgetMeta(todoWidget),
    },
    async ({ title }) => {
      const { db } = await connectToDatabase()
      const listId = nanoid()
      const shareToken = nanoid(16)

      await db.collection("todo_lists").insertOne({
        _id: listId,
        title,
        shareToken,
        createdAt: new Date(),
      })

      return {
        content: [
          {
            type: "text",
            text: `Created todo list: ${title}`,
          },
        ],
        structuredContent: {
          listId,
          title,
          shareToken,
          items: [],
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register add_todo_item tool
  server.registerTool(
    "add_todo_item",
    {
      title: "Add Todo Item",
      description: "Add a new item to a todo list",
      inputSchema: {
        listId: z.string().min(1).describe("The ID of the todo list"),
        text: z.string().min(1).describe("The text of the todo item"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      _meta: widgetMeta(todoWidget),
    },
    async ({ listId, text }) => {
      const { db } = await connectToDatabase()
      const itemId = nanoid()

      await db.collection("todo_items").insertOne({
        _id: itemId,
        listId,
        text,
        completed: false,
        createdAt: new Date(),
      })

      const items = await db.collection("todo_items").find({ listId }).sort({ createdAt: 1 }).toArray()

      return {
        content: [
          {
            type: "text",
            text: `Added item: ${text}`,
          },
        ],
        structuredContent: {
          listId,
          items: items.map((item) => ({
            id: item._id,
            text: item.text,
            completed: item.completed,
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register complete_todo_item tool
  server.registerTool(
    "complete_todo_item",
    {
      title: "Complete Todo Item",
      description: "Mark a todo item as completed",
      inputSchema: {
        listId: z.string().min(1).describe("The ID of the todo list"),
        itemId: z.string().min(1).describe("The ID of the todo item"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      _meta: widgetMeta(todoWidget),
    },
    async ({ listId, itemId }) => {
      const { db } = await connectToDatabase()

      await db.collection("todo_items").updateOne({ _id: itemId }, { $set: { completed: true } })

      const items = await db.collection("todo_items").find({ listId }).sort({ createdAt: 1 }).toArray()

      return {
        content: [
          {
            type: "text",
            text: `Completed item`,
          },
        ],
        structuredContent: {
          listId,
          items: items.map((item) => ({
            id: item._id,
            text: item.text,
            completed: item.completed,
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register delete_todo_item tool
  server.registerTool(
    "delete_todo_item",
    {
      title: "Delete Todo Item",
      description: "Delete a todo item from a list",
      inputSchema: {
        listId: z.string().min(1).describe("The ID of the todo list"),
        itemId: z.string().min(1).describe("The ID of the todo item"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      _meta: widgetMeta(todoWidget),
    },
    async ({ listId, itemId }) => {
      const { db } = await connectToDatabase()

      await db.collection("todo_items").deleteOne({ _id: itemId })

      const items = await db.collection("todo_items").find({ listId }).sort({ createdAt: 1 }).toArray()

      return {
        content: [
          {
            type: "text",
            text: `Deleted item`,
          },
        ],
        structuredContent: {
          listId,
          items: items.map((item) => ({
            id: item._id,
            text: item.text,
            completed: item.completed,
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register get_todo_list tool
  server.registerTool(
    "get_todo_list",
    {
      title: "Get Todo List",
      description: "Retrieve a todo list by ID",
      inputSchema: {
        listId: z.string().min(1).describe("The ID of the todo list"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      annotations: { readOnlyHint: true },
      _meta: widgetMeta(todoWidget),
    },
    async ({ listId }) => {
      const { db } = await connectToDatabase()

      const list = await db.collection("todo_lists").findOne({ _id: listId })
      const items = await db.collection("todo_items").find({ listId }).sort({ createdAt: 1 }).toArray()

      return {
        content: [
          {
            type: "text",
            text: `Todo list: ${list?.title || "Unknown"}`,
          },
        ],
        structuredContent: {
          listId,
          title: list?.title,
          items: items.map((item) => ({
            id: item._id,
            text: item.text,
            completed: item.completed,
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register list_todo_lists tool
  server.registerTool(
    "list_todo_lists",
    {
      title: "List Todo Lists",
      description: "Fetch all todo lists with their items",
      inputSchema: {},
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      annotations: { readOnlyHint: true },
      _meta: widgetMeta(todoWidget),
    },
    async () => {
      const { db } = await connectToDatabase()

      const lists = await db.collection("todo_lists").find({}).sort({ createdAt: -1 }).toArray()
      const itemsByList = await db
        .collection("todo_items")
        .aggregate([
          { $group: { _id: "$listId", items: { $push: { id: "$_id", text: "$text", completed: "$completed" } } } },
        ])
        .toArray()

      const itemsMap = new Map(itemsByList.map((entry) => [entry._id, entry.items]))

      return {
        content: [
          {
            type: "text",
            text: `Found ${lists.length} todo list${lists.length === 1 ? "" : "s"}`,
          },
        ],
        structuredContent: {
          lists: lists.map((list) => ({
            id: list._id,
            title: list.title,
            shareToken: list.shareToken,
            createdAt: list.createdAt,
            items: itemsMap.get(list._id) ?? [],
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )

  // Register upsert_todo_items tool
  server.registerTool(
    "upsert_todo_items",
    {
      title: "Bulk Upsert Todo Items",
      description: "Create or update multiple todo items in a list",
      inputSchema: {
        listId: z.string().min(1).describe("The ID of the todo list"),
        items: z
          .array(
            z
              .object({
                id: z.string().optional().describe("Existing item ID, omit for new items"),
                text: z.string().min(1).describe("Todo item text"),
                completed: z.boolean().optional().default(false).describe("Completion state"),
              })
              .strict(),
          )
          .min(1)
          .describe("Items to upsert"),
      },
      securitySchemes: DEFAULT_SECURITY_SCHEMES,
      _meta: widgetMeta(todoWidget),
    },
    async ({ listId, items }) => {
      const { db } = await connectToDatabase()

      const operations = items.map((item) => {
        const id = item.id ?? nanoid()
        return {
          updateOne: {
            filter: { _id: id },
            update: {
              $set: {
                _id: id,
                listId,
                text: item.text,
                completed: item.completed ?? false,
                updatedAt: new Date(),
              },
              $setOnInsert: {
                createdAt: new Date(),
              },
            },
            upsert: true,
          },
        }
      })

      if (operations.length > 0) {
        await db.collection("todo_items").bulkWrite(operations)
      }

      const list = await db.collection("todo_lists").findOne({ _id: listId })
      const updatedItems = await db.collection("todo_items").find({ listId }).sort({ createdAt: 1 }).toArray()

      return {
        content: [
          {
            type: "text",
            text: `Upserted ${operations.length} item${operations.length === 1 ? "" : "s"} in "${list?.title ?? "Todo List"}"`,
          },
        ],
        structuredContent: {
          listId,
          title: list?.title,
          items: updatedItems.map((item) => ({
            id: item._id,
            text: item.text,
            completed: item.completed,
          })),
        },
        _meta: widgetMeta(todoWidget),
      }
    },
  )
})

export const GET = handler
export const POST = handler
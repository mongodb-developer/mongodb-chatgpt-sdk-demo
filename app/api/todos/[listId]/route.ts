import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import type { NextRequest } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params
  const db = await getDatabase()

  try {
    const list = await db.collection("todo_lists").findOne({
      _id: new ObjectId(listId),
    })

    if (!list) {
      return Response.json({ error: "List not found" }, { status: 404 })
    }

    const items = await db
      .collection("todo_items")
      .find({ listId: new ObjectId(listId) })
      .sort({ order: 1 })
      .toArray()

    return Response.json({
      list: {
        id: list._id.toString(),
        title: list.title,
        shareToken: list.shareToken,
        createdAt: list.createdAt,
      },
      items: items.map((item) => ({
        id: item._id.toString(),
        text: item.text,
        completed: item.completed,
        order: item.order,
        createdAt: item.createdAt,
      })),
    })
  } catch (error) {
    console.error("[v0] Error fetching todo list:", error)
    return Response.json({ error: "Failed to fetch list" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ listId: string }> }) {
  const { listId } = await params
  const body = await request.json()
  const { action, itemId, text, completed } = body
  const db = await getDatabase()

  try {
    switch (action) {
      case "add": {
        const itemsCount = await db.collection("todo_items").countDocuments({
          listId: new ObjectId(listId),
        })

        const result = await db.collection("todo_items").insertOne({
          listId: new ObjectId(listId),
          text,
          completed: false,
          order: itemsCount,
          createdAt: new Date(),
        })

        return Response.json({
          id: result.insertedId.toString(),
          text,
          completed: false,
          order: itemsCount,
        })
      }

      case "toggle": {
        await db
          .collection("todo_items")
          .updateOne({ _id: new ObjectId(itemId), listId: new ObjectId(listId) }, { $set: { completed } })

        return Response.json({ success: true })
      }

      case "delete": {
        await db.collection("todo_items").deleteOne({
          _id: new ObjectId(itemId),
          listId: new ObjectId(listId),
        })

        return Response.json({ success: true })
      }

      default:
        return Response.json({ error: "Invalid action" }, { status: 400 })
    }
  } catch (error) {
    console.error("[v0] Error updating todo list:", error)
    return Response.json({ error: "Failed to update list" }, { status: 500 })
  }
}

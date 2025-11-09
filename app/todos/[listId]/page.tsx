import { getDatabase } from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { notFound } from "next/navigation"
import TodoListWidget from "@/components/todo-list-widget"

export default async function TodoListPage({
  params,
}: {
  params: Promise<{ listId: string }>
}) {
  const { listId } = await params
  const db = await getDatabase()

  try {
    const list = await db.collection("todo_lists").findOne({
      _id: new ObjectId(listId),
    })

    if (!list) {
      notFound()
    }

    const items = await db
      .collection("todo_items")
      .find({ listId: new ObjectId(listId) })
      .sort({ order: 1 })
      .toArray()

    return (
      <TodoListWidget
        listId={listId}
        title={list.title}
        shareToken={list.shareToken}
        initialItems={items.map((item) => ({
          id: item._id.toString(),
          text: item.text,
          completed: item.completed,
          order: item.order,
        }))}
      />
    )
  } catch (error) {
    console.error("[v0] Error loading todo list:", error)
    notFound()
  }
}

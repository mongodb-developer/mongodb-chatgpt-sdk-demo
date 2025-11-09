"use client"

import { useState } from "react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Share2, Trash2, Plus } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface TodoItem {
  id: string
  text: string
  completed: boolean
  order: number
}

interface TodoListWidgetProps {
  listId: string
  title: string
  shareToken: string
  initialItems: TodoItem[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function TodoListWidget({ listId, title, shareToken, initialItems }: TodoListWidgetProps) {
  const [newItemText, setNewItemText] = useState("")
  const { toast } = useToast()

  const { data, mutate } = useSWR(`/api/todos/${listId}`, fetcher, {
    fallbackData: { list: { title, shareToken }, items: initialItems },
    revalidateOnFocus: true,
    refreshInterval: 5000,
  })

  const items = data?.items || []

  const addItem = async () => {
    if (!newItemText.trim()) return

    const optimisticItem = {
      id: "temp-" + Date.now(),
      text: newItemText,
      completed: false,
      order: items.length,
    }

    mutate({ ...data, items: [...items, optimisticItem] }, false)

    setNewItemText("")

    try {
      await fetch(`/api/todos/${listId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", text: newItemText }),
      })

      mutate()
    } catch (error) {
      console.error("[v0] Error adding item:", error)
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive",
      })
      mutate()
    }
  }

  const toggleItem = async (itemId: string, completed: boolean) => {
    const optimisticItems = items.map((item: TodoItem) => (item.id === itemId ? { ...item, completed } : item))

    mutate({ ...data, items: optimisticItems }, false)

    try {
      await fetch(`/api/todos/${listId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", itemId, completed }),
      })

      mutate()
    } catch (error) {
      console.error("[v0] Error toggling item:", error)
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive",
      })
      mutate()
    }
  }

  const deleteItem = async (itemId: string) => {
    const optimisticItems = items.filter((item: TodoItem) => item.id !== itemId)

    mutate({ ...data, items: optimisticItems }, false)

    try {
      await fetch(`/api/todos/${listId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", itemId }),
      })

      mutate()
    } catch (error) {
      console.error("[v0] Error deleting item:", error)
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      })
      mutate()
    }
  }

  const shareList = () => {
    const shareUrl = `${window.location.origin}/todos/${listId}?token=${shareToken}`
    navigator.clipboard.writeText(shareUrl)
    toast({
      title: "Link copied!",
      description: "Share this link with others",
    })
  }

  const completedCount = items.filter((item: TodoItem) => item.completed).length
  const totalCount = items.length

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">{title}</CardTitle>
            <Button variant="outline" size="icon" onClick={shareList}>
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
          {totalCount > 0 && (
            <p className="text-sm text-muted-foreground">
              {completedCount} of {totalCount} completed
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Add a new todo..."
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  addItem()
                }
              }}
            />
            <Button onClick={addItem} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">No todos yet. Add one above!</p>
            ) : (
              items.map((item: TodoItem) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <Checkbox
                    checked={item.completed}
                    onCheckedChange={(checked) => toggleItem(item.id, checked as boolean)}
                  />
                  <span className={`flex-1 ${item.completed ? "text-muted-foreground line-through" : ""}`}>
                    {item.text}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

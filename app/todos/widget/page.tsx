"use client"

import { useWidgetProps } from "@/lib/openai"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Card } from "@/components/ui/card"
import { Plus, Trash2, Share2 } from "lucide-react"

interface TodoItem {
  id: string
  text: string
  completed: boolean
}

interface TodoListData {
  listId: string
  title: string
  items?: TodoItem[]
  shareUrl?: string
  shareToken?: string
}

export default function TodoWidget() {
  const props = useWidgetProps<any>()

  console.log("[v0] TodoWidget - Raw props:", props)
  console.log("[v0] TodoWidget - window.openai:", typeof window !== "undefined" ? window.openai : "SSR")

  // Try multiple paths to find the data
  const data =
    props?.result?.structuredContent ??
    props?.result?.structured_content ??
    props?.structuredContent ??
    props?.structured_content ??
    (props?.listId ? props : null) // Direct data without nesting

  console.log("[v0] TodoWidget - Extracted data:", data)

  const [items, setItems] = useState<TodoItem[]>(data?.items || [])
  const [newItemText, setNewItemText] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (data?.items) {
      console.log("[v0] TodoWidget - Updating items from data:", data.items)
      setItems(data.items)
    }
  }, [data?.items])

  const handleAddItem = () => {
    if (!newItemText.trim() || !data?.listId) return

    const newItem: TodoItem = {
      id: `temp-${Date.now()}`,
      text: newItemText,
      completed: false,
    }

    setItems([...items, newItem])
    setNewItemText("")

    // Call the tool to add the item
    if (window?.openai?.callTool) {
      window.openai.callTool("add_todo_item", {
        listId: data.listId,
        text: newItemText,
      })
    }
  }

  const handleToggleItem = (itemId: string, completed: boolean) => {
    setItems(items.map((item) => (item.id === itemId ? { ...item, completed } : item)))

    if (window?.openai?.callTool && data?.listId) {
      window.openai.callTool("complete_todo_item", {
        listId: data.listId,
        itemId,
      })
    }
  }

  const handleDeleteItem = (itemId: string) => {
    setItems(items.filter((item) => item.id !== itemId))

    if (window?.openai?.callTool && data?.listId) {
      window.openai.callTool("delete_todo_item", {
        listId: data.listId,
        itemId,
      })
    }
  }

  const handleShare = () => {
    if (data?.shareUrl) {
      navigator.clipboard.writeText(data.shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 gap-4">
        <p className="text-muted-foreground">Loading todo list...</p>
        <details className="text-xs text-muted-foreground max-w-2xl w-full">
          <summary className="cursor-pointer hover:text-foreground">🐛 Debug Info (click to expand)</summary>
          <div className="mt-2 p-4 bg-muted rounded-lg overflow-auto">
            <p className="font-semibold mb-2">Raw Props:</p>
            <pre className="text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(props, null, 2)}</pre>
            <p className="font-semibold mt-4 mb-2">Window OpenAI:</p>
            <pre className="text-[10px] whitespace-pre-wrap break-all">
              {typeof window !== "undefined"
                ? JSON.stringify(
                    {
                      exists: !!window.openai,
                      toolOutput: window.openai?.toolOutput,
                      callTool: typeof window.openai?.callTool,
                    },
                    null,
                    2,
                  )
                : "SSR - window not available"}
            </pre>
          </div>
        </details>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <Card className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          {data.shareUrl && (
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Share"}
            </Button>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          <Input
            placeholder="Add a new todo..."
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
          />
          <Button onClick={handleAddItem}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No items yet. Add one above!</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={(checked) => handleToggleItem(item.id, checked as boolean)}
                />
                <span className={`flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>
                  {item.text}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteItem(item.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 pt-6 border-t text-sm text-muted-foreground">
          <p>
            {items.filter((i) => !i.completed).length} of {items.length} items remaining
          </p>
        </div>
      </Card>
    </div>
  )
}

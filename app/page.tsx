import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <CheckSquare className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">ChatGPT Todo Lists</CardTitle>
          <CardDescription>Shareable todo lists powered by ChatGPT MCP</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>This app integrates with ChatGPT to create and manage shareable todo lists.</p>
          <div className="space-y-2">
            <p className="font-medium text-foreground">Available commands:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Create a new todo list</li>
              <li>Add items to your list</li>
              <li>Mark items as complete</li>
              <li>Delete items</li>
              <li>Share your list with others</li>
            </ul>
          </div>
          <p className="text-xs">
            Connect this app to ChatGPT using the MCP endpoint at{" "}
            <code className="rounded bg-muted px-1 py-0.5">/mcp</code>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

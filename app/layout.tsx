import type React from "react"
import type { Metadata } from "next"
import { baseURL } from "@/baseUrl"
import "./globals.css"
import { NextChatSDKBootstrap } from "@/components/next-chat-sdk-bootstrap"

import { Geist as V0_Font_Geist, Geist_Mono as V0_Font_Geist_Mono, Source_Serif_4 as V0_Font_Source_Serif_4 } from "next/font/google"

// Initialize fonts
const _geist = V0_Font_Geist({ subsets: ["latin"], weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] })
const _geistMono = V0_Font_Geist_Mono({ subsets: ["latin"], weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"] })
const _sourceSerif_4 = V0_Font_Source_Serif_4({ subsets: ["latin"], weight: ["200", "300", "400", "500", "600", "700", "800", "900"] })

export const metadata: Metadata = {
  title: "ChatGPT Todo List",
  description: "Shareable todo lists for ChatGPT MCP apps",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <NextChatSDKBootstrap baseUrl={baseURL} />
      </head>
      <body>{children}</body>
    </html>
  )
}

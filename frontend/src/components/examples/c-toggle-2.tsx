import { Toggle } from "@/components/ui/toggle"
import { ItalicIcon, BoldIcon } from "lucide-react"

export function Pattern() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Toggle variant="outline" aria-label="Toggle italic">
        <ItalicIcon
        />
        Italic
      </Toggle>
      <Toggle variant="outline" aria-label="Toggle bold">
        <BoldIcon
        />
        Bold
      </Toggle>
    </div>
  )
}
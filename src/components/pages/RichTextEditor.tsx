'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import { Bold, Italic, UnderlineIcon, Strikethrough, List, ListOrdered, Quote, Minus, Undo, Redo } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface Props {
  value: string
  onChange: (html: string) => void
}

export function RichTextEditor({ value, onChange }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-invert prose-sm max-w-none min-h-[180px] px-4 py-3 focus:outline-none',
      },
    },
  })

  if (!editor) return null

  const btn = (active: boolean, action: () => void, title: string, children: React.ReactNode) => (
    <button
      type="button"
      title={title}
      onClick={action}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-700 hover:text-slate-100'
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-700 bg-slate-800/80">
        {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold', <Bold className="h-3.5 w-3.5" />)}
        {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic', <Italic className="h-3.5 w-3.5" />)}
        {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline', <UnderlineIcon className="h-3.5 w-3.5" />)}
        {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough', <Strikethrough className="h-3.5 w-3.5" />)}

        <span className="w-px h-4 bg-slate-700 mx-1" />

        {(['1', '2', '3'] as const).map((level) =>
          btn(
            editor.isActive('heading', { level: Number(level) }),
            () => editor.chain().focus().toggleHeading({ level: Number(level) as 1 | 2 | 3 }).run(),
            `Heading ${level}`,
            <span className="text-xs font-bold leading-none">H{level}</span>
          )
        )}

        <span className="w-px h-4 bg-slate-700 mx-1" />

        {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List className="h-3.5 w-3.5" />)}
        {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', <ListOrdered className="h-3.5 w-3.5" />)}
        {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Blockquote', <Quote className="h-3.5 w-3.5" />)}
        {btn(false, () => editor.chain().focus().setHorizontalRule().run(), 'Divider', <Minus className="h-3.5 w-3.5" />)}

        <span className="w-px h-4 bg-slate-700 mx-1" />

        {btn(!editor.can().undo(), () => editor.chain().focus().undo().run(), 'Undo', <Undo className="h-3.5 w-3.5" />)}
        {btn(!editor.can().redo(), () => editor.chain().focus().redo().run(), 'Redo', <Redo className="h-3.5 w-3.5" />)}
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  )
}

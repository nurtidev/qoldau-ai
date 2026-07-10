import { create } from 'zustand'

/**
 * Глобальное состояние AI-консультанта (плавающий виджет чата).
 * Вынесено в стор, чтобы любая страница (например, «Контакты») могла
 * открыть чат без прокидывания пропсов через Layout.
 */
interface AssistantState {
  open: boolean
  setOpen: (open: boolean) => void
}

export const useAssistant = create<AssistantState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))

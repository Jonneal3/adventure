import * as React from "react"

// import type {
//   ToastActionElement,
//   ToastProps,
// } from "../../components/ui/toast" // TODO: Fix when components package is built

// Temporary type definitions until components package is built
type ToastProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "default" | "destructive";
  duration?: number;
};

type ToastActionElement = React.ReactElement;

type ToasterToast = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: "default" | "destructive";
  duration?: number;
}

type State = {
  toasts: ToasterToast[]
}

const TOAST_LIMIT = 3
const DUPLICATE_TOAST_WINDOW_MS = 1200

const initialState: State = {
  toasts: [],
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = initialState

const recentToastsByKey = new Map<string, { id: string; shownAt: number }>()

function dispatch(action: { type: "ADD_TOAST" | "DISMISS_TOAST"; toast?: ToasterToast; toastId?: string }) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

function reducer(state: State, action: { type: "ADD_TOAST" | "DISMISS_TOAST"; toast?: ToasterToast; toastId?: string }): State {
  switch (action.type) {
    case "ADD_TOAST":
      return {
        ...state,
        toasts: [...state.toasts, action.toast!].slice(-TOAST_LIMIT),
      }
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: action.toastId ? state.toasts.filter((t) => t.id !== action.toastId) : [],
      }
    default:
      return state
  }
}

type ToastInput = Omit<ToasterToast, "id"> & {
  id?: string
  dedupeKey?: string
  dedupe?: boolean
}

function safeToString(value: unknown): string {
  if (typeof value === "string") return value
  if (typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "true" : "false"
  if (value == null) return ""
  return String(value)
}

function getToastKey(props: Pick<ToastInput, "title" | "description" | "variant">, dedupeKey?: string) {
  if (dedupeKey) return dedupeKey
  const title = safeToString(props.title).trim()
  const description = safeToString(props.description).trim()
  if (!title && !description) return null
  return `${props.variant ?? "default"}::${title}::${description}`
}

function pruneRecentToasts(now: number) {
  const keysToDelete: string[] = []
  recentToastsByKey.forEach((value, key) => {
    if (now - value.shownAt > 30_000) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach((key) => recentToastsByKey.delete(key))
}

function toast({ id: providedId, dedupeKey, dedupe = true, onOpenChange, ...props }: ToastInput) {
  const now = Date.now()
  pruneRecentToasts(now)

  const key = dedupe ? getToastKey(props, dedupeKey) : null
  if (dedupe && key) {
    const recent = recentToastsByKey.get(key)
    if (recent && now - recent.shownAt < DUPLICATE_TOAST_WINDOW_MS) {
      const isStillPresent = memoryState.toasts.some((t) => t.id === recent.id)
      if (isStillPresent) return recent.id
    }
  }

  const id = providedId ?? Math.random().toString(36).substring(2, 9)
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        onOpenChange?.(open)
        if (!open) dispatch({ type: "DISMISS_TOAST", toastId: id })
      },
    },
  })

  if (dedupe && key) {
    recentToastsByKey.set(key, { id, shownAt: now })
  }

  return id
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { type ToasterToast, type ToastProps, type ToastActionElement } 

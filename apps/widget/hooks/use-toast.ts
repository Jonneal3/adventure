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

const initialState: State = {
  toasts: [],
}

const listeners: Array<(state: State) => void> = []

let memoryState: State = initialState

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
        toasts: [...state.toasts, action.toast!],
      }
    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

type Toast = Omit<ToasterToast, "id">

function toast({ ...props }: Toast) {
  const id = Math.random().toString(36).substring(2, 9)
  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dispatch({ type: "DISMISS_TOAST", toastId: id })
      },
    },
  })
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
  }, [state])

  return {
    ...state,
    toast,
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { type ToasterToast, type ToastProps, type ToastActionElement } 
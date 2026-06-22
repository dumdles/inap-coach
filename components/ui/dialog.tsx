"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/30 duration-100 supports-backdrop-filter:backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  )
}

// Distance (px) the sheet must be dragged down before a release counts as "dismiss".
const SWIPE_DISMISS_THRESHOLD = 120
// Mobile/desktop split — matches the `sm` breakpoint used by the responsive classes below.
const MOBILE_BREAKPOINT = 640

// Walks up from `node` to `root` looking for a vertically-scrollable ancestor.
// Used so a downward drag inside a scrolled list scrolls the list first, and
// only starts dragging the sheet itself once that list is already at the top.
function findScrollableAncestor(node: HTMLElement | null, root: HTMLElement): HTMLElement | null {
  let el = node
  while (el && el !== root.parentElement) {
    const overflowY = window.getComputedStyle(el).overflowY
    if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight + 1) {
      return el
    }
    if (el === root) break
    el = el.parentElement
  }
  return null
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  swipeToDismiss = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  /** Mobile-only: lets the cadet drag the bottom sheet down to dismiss it. */
  swipeToDismiss?: boolean
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const closeRef = React.useRef<HTMLButtonElement>(null)
  // Mutable per-gesture scratch space — doesn't need to trigger re-renders.
  const gesture = React.useRef<{ startX: number; startY: number; dragging: boolean; scrollEl: HTMLElement | null } | null>(null)

  // `dragY` mirrors the live drag offset. `dragActive` flips on once a drag is
  // first recognised and stays on for the rest of this open — that's what lets
  // us apply the inline transform only on mobile (where dragging can start)
  // without ever touching the desktop centering transform.
  const [dragY, setDragY] = React.useState(0)
  const [dragging, setDragging] = React.useState(false)
  const [dragActive, setDragActive] = React.useState(false)

  function handleTouchStart(e: React.TouchEvent) {
    if (!swipeToDismiss || window.innerWidth >= MOBILE_BREAKPOINT) return
    const touch = e.touches[0]
    const scrollEl = panelRef.current ? findScrollableAncestor(e.target as HTMLElement, panelRef.current) : null
    gesture.current = { startX: touch.clientX, startY: touch.clientY, dragging: false, scrollEl }
  }

  function handleTouchMove(e: React.TouchEvent) {
    const state = gesture.current
    if (!state) return
    const touch = e.touches[0]
    const dy = touch.clientY - state.startY
    const dx = touch.clientX - state.startX

    if (!state.dragging) {
      // Wait for a clear, mostly-vertical, downward gesture before deciding.
      if (Math.abs(dy) < 6 || Math.abs(dy) <= Math.abs(dx) || dy < 0) return
      // If the touch started inside a list that's still scrolled down, let it
      // scroll back to the top first rather than hijacking the gesture.
      if (state.scrollEl && state.scrollEl.scrollTop > 0) {
        gesture.current = null
        return
      }
      state.dragging = true
      setDragging(true)
      setDragActive(true)
    }

    e.preventDefault()
    setDragY(Math.max(0, dy))
  }

  function handleTouchEnd() {
    const state = gesture.current
    gesture.current = null
    if (!state?.dragging) return
    setDragging(false)
    if (dragY > SWIPE_DISMISS_THRESHOLD) {
      // Carry on sliding the rest of the way off-screen, then actually close.
      setDragY(window.innerHeight)
      setTimeout(() => closeRef.current?.click(), 200)
    } else {
      setDragY(0)
    }
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={panelRef}
        data-slot="dialog-content"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={dragActive ? { transform: `translateY(${dragY}px)`, transition: dragging ? "none" : "transform 200ms ease-out" } : undefined}
        className={cn(
          // Mobile (base): a bottom sheet pinned to the bottom edge, full-width,
          // rounded only at the top, sliding up from below.
          "fixed inset-x-0 bottom-0 left-0 top-auto z-50 grid w-full max-w-full translate-x-0 translate-y-0 gap-6 rounded-t-3xl rounded-b-none bg-popover p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] text-sm text-popover-foreground shadow-xl ring-1 ring-foreground/5 duration-200 outline-none dark:ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-[100%] data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-[100%]",
          // Desktop (sm+): restore the centered modal with a zoom transition.
          "sm:inset-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-4xl sm:p-6 sm:pb-6 sm:duration-100 sm:data-open:zoom-in-95 sm:data-open:slide-in-from-bottom-0 sm:data-closed:zoom-out-95 sm:data-closed:slide-out-to-bottom-0",
          className
        )}
        {...props}
      >
        {swipeToDismiss && (
          <div className="sm:hidden flex justify-center pt-2 pb-1 touch-none">
            <div className="w-10 h-1.5 rounded-full bg-muted-foreground/25" />
          </div>
        )}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-4 right-4 bg-secondary"
              size="sm"
            >
              <XIcon
              />
              <span className="sr-only">Close</span>
            </Button>
          </DialogPrimitive.Close>
        )}
        {/* Hidden close trigger — clicked programmatically once a swipe-to-dismiss drag clears the threshold. */}
        {swipeToDismiss && <DialogPrimitive.Close ref={closeRef} className="hidden" aria-hidden tabIndex={-1} />}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

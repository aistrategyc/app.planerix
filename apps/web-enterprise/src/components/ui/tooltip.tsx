import React, { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  children: React.ReactNode
  className?: string
}

interface TooltipContentProps {
  children: React.ReactNode
  className?: string
}

interface TooltipTriggerProps {
  asChild?: boolean
  children: React.ReactNode
  className?: string
}

interface TooltipProviderProps {
  children: React.ReactNode
}

const TooltipProvider: React.FC<TooltipProviderProps> = ({ children }) => {
  return <>{children}</>
}

const Tooltip: React.FC<TooltipProps> = ({ children, className }) => {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleMouseEnter = () => setIsOpen(true)
    const handleMouseLeave = () => setIsOpen(false)
    const handleFocus = () => setIsOpen(true)
    const handleBlur = () => setIsOpen(false)

    const trigger = triggerRef.current
    if (trigger) {
      trigger.addEventListener("mouseenter", handleMouseEnter)
      trigger.addEventListener("mouseleave", handleMouseLeave)
      trigger.addEventListener("focus", handleFocus)
      trigger.addEventListener("blur", handleBlur)
      return () => {
        trigger.removeEventListener("mouseenter", handleMouseEnter)
        trigger.removeEventListener("mouseleave", handleMouseLeave)
        trigger.removeEventListener("focus", handleFocus)
        trigger.removeEventListener("blur", handleBlur)
      }
    }
  }, [])

  return (
    <div className={cn("relative inline-block", className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          if (child.type === TooltipTrigger) {
            return React.cloneElement(
              child as React.ReactElement<{ ref?: React.Ref<HTMLDivElement> }>,
              { ref: triggerRef }
            )
          }
          if (child.type === TooltipContent) {
            return React.cloneElement(
              child as React.ReactElement<{ ref?: React.Ref<HTMLDivElement>; style?: React.CSSProperties }>,
              {
                style: { display: isOpen ? "block" : "none" },
                ref: contentRef,
              }
            )
          }
        }
        return child
      })}
    </div>
  )
}

const TooltipTrigger = React.forwardRef<HTMLDivElement, TooltipTriggerProps>(
  ({ asChild, children, className }, ref) => {
  const Component = asChild ? "div" : "button"
  return (
    <Component
      className={cn("inline-flex items-center", className)}
      tabIndex={0}
      ref={ref}
    >
      {children}
    </Component>
  )
})
TooltipTrigger.displayName = "TooltipTrigger"

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ children, className }, ref) => {
  return (
    <div
      className={cn(
        "absolute z-50 bg-gray-800 text-white text-sm p-2 rounded-md shadow-lg min-w-max top-full mt-2",
        className
      )}
      ref={ref}
    >
      {children}
    </div>
  )
})
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }

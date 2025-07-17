import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { handleKeyboardNavigation } from "@/lib/accessibility"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  /** Accessible label for screen readers when button only contains an icon */
  accessibleLabel?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, accessibleLabel, onClick, onKeyDown, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    // Enhanced keyboard handling for accessibility
    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Handle custom keyboard navigation
      handleKeyboardNavigation(e, {
        'Enter': () => onClick && onClick(e as unknown as React.MouseEvent<HTMLButtonElement>),
        ' ': () => onClick && onClick(e as unknown as React.MouseEvent<HTMLButtonElement>),
      });
      
      // Call the original onKeyDown if provided
      onKeyDown?.(e);
    };
    
    // Ensure button has a type to prevent form submission
    const buttonType = props.type || 'button';
    
    // Add aria-label for icon-only buttons
    const ariaProps: Record<string, string> = {};
    if (accessibleLabel) {
      ariaProps['aria-label'] = accessibleLabel;
    }
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onKeyDown={handleKeyDown}
        type={buttonType}
        {...ariaProps}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
import * as React from "react";
import { Controller } from "react-hook-form";
import { Label } from "../ui/label";
import { cn } from "../../lib/utils";
export function FormField({ control, name, label, description, required, className, children, }) {
    return (<Controller control={control} name={name} render={({ field, fieldState }) => (<div className={cn("space-y-2", className)}>
          {label && (<Label htmlFor={name} className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
              {label}
            </Label>)}
          {children(field)}
          {fieldState.error && (<p className="text-sm text-destructive">{fieldState.error.message}</p>)}
          {description && !fieldState.error && (<p className="text-sm text-muted-foreground">{description}</p>)}
        </div>)}/>);
}

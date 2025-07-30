import * as React from "react"
import { Controller, FieldPath, FieldValues, Control } from "react-hook-form"
import { Label } from "../ui/label"
import { cn } from "../../lib/utils"

interface FormFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  required?: boolean
  className?: string
  children: (field: {
    value: any
    onChange: (value: any) => void
    onBlur: () => void
    name: string
  }) => React.ReactElement
}

export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <div className={cn("space-y-2", className)}>
          {label && (
            <Label htmlFor={name} className={required ? "after:content-['*'] after:ml-0.5 after:text-red-500" : ""}>
              {label}
            </Label>
          )}
          {children(field)}
          {fieldState.error && (
            <p className="text-sm text-destructive">{fieldState.error.message}</p>
          )}
          {description && !fieldState.error && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      )}
    />
  )
}
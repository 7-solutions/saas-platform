import * as React from "react"
import { FieldPath, FieldValues, Control } from "react-hook-form"
import { FormField } from "./form-field"
import { Input, InputProps } from "../ui/input"

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> extends Omit<InputProps, "name"> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  required?: boolean
}

export function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  required,
  ...inputProps
}: FormInputProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      required={required}
    >
      {(field) => (
        <Input
          {...inputProps}
          {...field}
          id={name}
        />
      )}
    </FormField>
  )
}
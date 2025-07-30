import * as React from "react";
import { FieldPath, FieldValues, Control } from "react-hook-form";
import { InputProps } from "../ui/input";
interface FormInputProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> extends Omit<InputProps, "name"> {
    control: Control<TFieldValues>;
    name: TName;
    label?: string;
    description?: string;
    required?: boolean;
}
export declare function FormInput<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ control, name, label, description, required, ...inputProps }: FormInputProps<TFieldValues, TName>): React.JSX.Element;
export {};
//# sourceMappingURL=form-input.d.ts.map
import * as React from "react";
import { FieldPath, FieldValues, Control } from "react-hook-form";
interface FormFieldProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> {
    control: Control<TFieldValues>;
    name: TName;
    label?: string;
    description?: string;
    required?: boolean;
    className?: string;
    children: (field: {
        value: any;
        onChange: (value: any) => void;
        onBlur: () => void;
        name: string;
    }) => React.ReactElement;
}
export declare function FormField<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ control, name, label, description, required, className, children, }: FormFieldProps<TFieldValues, TName>): React.JSX.Element;
export {};
//# sourceMappingURL=form-field.d.ts.map
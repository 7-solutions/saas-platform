import * as React from "react";
import { FieldPath, FieldValues, Control } from "react-hook-form";
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    options: Array<{
        value: string;
        label: string;
    }>;
    placeholder?: string;
}
declare const Select: React.ForwardRefExoticComponent<SelectProps & React.RefAttributes<HTMLSelectElement>>;
interface FormSelectProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> extends Omit<SelectProps, "name"> {
    control: Control<TFieldValues>;
    name: TName;
    label?: string;
    description?: string;
    required?: boolean;
}
export declare function FormSelect<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ control, name, label, description, required, ...selectProps }: FormSelectProps<TFieldValues, TName>): React.JSX.Element;
export { Select };
//# sourceMappingURL=form-select.d.ts.map
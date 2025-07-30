import * as React from "react";
import { FieldPath, FieldValues, Control } from "react-hook-form";
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
}
declare const Textarea: React.ForwardRefExoticComponent<TextareaProps & React.RefAttributes<HTMLTextAreaElement>>;
interface FormTextareaProps<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>> extends Omit<TextareaProps, "name"> {
    control: Control<TFieldValues>;
    name: TName;
    label?: string;
    description?: string;
    required?: boolean;
}
export declare function FormTextarea<TFieldValues extends FieldValues = FieldValues, TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>>({ control, name, label, description, required, ...textareaProps }: FormTextareaProps<TFieldValues, TName>): React.JSX.Element;
export { Textarea };
//# sourceMappingURL=form-textarea.d.ts.map
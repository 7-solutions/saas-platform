import * as React from "react";
import { FormField } from "./form-field";
import { cn } from "../../lib/utils";
const Select = React.forwardRef(({ className, options, placeholder, ...props }, ref) => {
    return (<select className={cn("flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", className)} ref={ref} {...props}>
        {placeholder && (<option value="" disabled>
            {placeholder}
          </option>)}
        {options.map((option) => (<option key={option.value} value={option.value}>
            {option.label}
          </option>))}
      </select>);
});
Select.displayName = "Select";
export function FormSelect({ control, name, label, description, required, ...selectProps }) {
    return (<FormField control={control} name={name} label={label} description={description} required={required}>
      {(field) => (<Select {...selectProps} {...field} id={name}/>)}
    </FormField>);
}
export { Select };

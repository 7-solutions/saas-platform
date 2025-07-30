import * as React from "react";
import { FormField } from "./form-field";
import { Input } from "../ui/input";
export function FormInput({ control, name, label, description, required, ...inputProps }) {
    return (<FormField control={control} name={name} label={label} description={description} required={required}>
      {(field) => (<Input {...inputProps} {...field} id={name}/>)}
    </FormField>);
}

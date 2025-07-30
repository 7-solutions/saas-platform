import * as React from "react";
import { z } from "zod";
declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginFormData = z.infer<typeof loginSchema>;
interface LoginFormProps {
    onSubmit: (data: LoginFormData) => Promise<void>;
    isLoading?: boolean;
    error?: string;
    title?: string;
    description?: string;
}
export declare function LoginForm({ onSubmit, isLoading, error, title, description, }: LoginFormProps): React.JSX.Element;
export {};
//# sourceMappingURL=login-form.d.ts.map
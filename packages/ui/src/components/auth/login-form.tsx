import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "../ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card"
import { FormInput } from "../forms/form-input"
import { Alert, AlertDescription } from "../ui/alert"
import { Loader2 } from "lucide-react"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})

export type LoginFormData = z.infer<typeof loginSchema>

interface LoginFormProps {
  onSubmit: (data: LoginFormData) => Promise<void>
  isLoading?: boolean
  error?: string
  title?: string
  description?: string
}

export function LoginForm({
  onSubmit,
  isLoading = false,
  error,
  title = "Sign In",
  description = "Enter your credentials to access your account",
}: LoginFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const handleFormSubmit = async (data: LoginFormData) => {
    try {
      await onSubmit(data)
    } catch (err) {
      // Error handling is managed by parent component
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">{title}</CardTitle>
        <CardDescription className="text-center">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormInput
            control={control}
            name="email"
            label="Email"
            type="email"
            placeholder="Enter your email"
            required
            disabled={isLoading}
          />
          
          <FormInput
            control={control}
            name="password"
            label="Password"
            type="password"
            placeholder="Enter your password"
            required
            disabled={isLoading}
          />
          
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
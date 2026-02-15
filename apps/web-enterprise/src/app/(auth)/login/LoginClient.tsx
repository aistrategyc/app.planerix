"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { cn } from "@/lib/utils"
import AuthLayout from "@/components/layouts/authlayout"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { resendVerification } from "@/lib/api/auth"

import { Eye, EyeOff, AlertCircle, Loader2 } from "lucide-react"

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, user, isLoading, isAuthenticated, error: authError, clearError } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  })

  const emailValue = watch("email")
  const passwordValue = watch("password")

  const redirectParam = searchParams.get("redirect")
  const safeRedirect = redirectParam && redirectParam.startsWith("/") && redirectParam !== "/login"
    ? redirectParam
    : null

  useEffect(() => {
    if (!user || isLoading || !isAuthenticated) return
    if (!safeRedirect) return
    router.replace(safeRedirect)
    router.refresh()
  }, [user, isLoading, isAuthenticated, router, safeRedirect])

  useEffect(() => {
    if (authError) clearError()
  }, [emailValue, passwordValue, authError, clearError])

  const isUnverified = !!authError && /not\s+verified|verify\s+your\s+email|email\s+not\s+verified/i.test(authError)

  const handleResend = async () => {
    if (!emailValue) return
    setResending(true)
    setResent(false)
    try {
      await resendVerification(emailValue)
      setResent(true)
    } catch (e) {
      console.error("Resend verification failed", e)
    } finally {
      setResending(false)
    }
  }

  const onSubmit = async (data: LoginForm) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    clearError()

    const success = await login(data.email, data.password)
    if (success) {
      router.replace(safeRedirect || "/dashboard")
      router.refresh()
    }

    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <AuthLayout title="Planerix" subtitle="Checking your session…">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your account to continue.">
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {authError && !isUnverified && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          {isUnverified && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your email is not verified yet. Please check your inbox. You can
                <button
                  type="button"
                  onClick={handleResend}
                  className="ml-1 underline underline-offset-2"
                  disabled={resending || !emailValue}
                >
                  {resending ? "resending…" : "resend the verification email"}
                </button>
                .
                {resent && (
                  <span className="ml-1 text-green-600">Email sent!</span>
                )}
                <button
                  type="button"
                  onClick={() => router.push(`/verify-email?email=${encodeURIComponent(emailValue || "")}`)}
                  className="ml-2 text-primary underline underline-offset-2"
                >
                  Open verification page
                </button>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                {...register("email")}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email"
                className={cn(
                  "transition-colors",
                  errors.email && "border-destructive focus-visible:ring-destructive"
                )}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  {...register("password")}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className={cn(
                    "pr-10 transition-colors",
                    errors.password && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

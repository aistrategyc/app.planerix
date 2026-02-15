"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useEffect } from "react"
import { z } from "zod"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/auth-context"
import AuthLayout from "@/components/layouts/authlayout"

// ✅ СХЕМА ВАЛИДАЦИИ С first_name и last_name
const registerSchema = z.object({
  email: z.string().email({ message: "Введите корректный email" }),
  password: z
    .string()
    .min(8, { message: "Минимум 8 символов" })
    .regex(/[A-Z]/, { message: "Пароль должен содержать заглавную букву" })
    .regex(/[a-z]/, { message: "Пароль должен содержать строчную букву" })
    .regex(/[0-9]/, { message: "Пароль должен содержать цифру" })
    .regex(/[!@#$%^&*(),.?":{}|<>]/, { message: "Пароль должен содержать спецсимвол" }),
  username: z.string().min(3, { message: "Введите имя пользователя" }),
  first_name: z.string().min(1, { message: "Введите имя" }),
  last_name: z.string().min(1, { message: "Введите фамилию" }),
  terms_accepted: z.boolean().refine((val) => val === true, {
    message: "Необходимо принять условия использования",
  }),
})

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const { register: doRegister, error: authError, clearError } = useAuth()

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      password: "",
      username: "",
      first_name: "",
      last_name: "",
      terms_accepted: false,
    },
  })

  useEffect(() => {
    // sync external auth error from useAuth into local banner
    if (authError) setApiError(authError)
  }, [authError])

  // reset both local and global errors on any change
  useEffect(() => {
    if (apiError) setApiError(null)
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch("email"), watch("password"), watch("username"), watch("first_name"), watch("last_name"), watch("terms_accepted")])

  const onSubmit = async (data: RegisterForm) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setApiError(null)

    try {
      await doRegister(data)
      // navigation happens inside useAuth.register (to /verify-email)
    } catch {
      // useAuth already handles the error and sets authError
      // No need to extract error message here
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Создать аккаунт" subtitle="Заполните форму для регистрации.">
      <div className="space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {(authError) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{authError}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {/* Имя пользователя */}
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                placeholder="username"
                {...register("username")}
                className={errors.username ? "border-destructive" : ""}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            {/* Имя и Фамилия */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя</Label>
                <Input
                  id="first_name"
                  placeholder="Иван"
                  {...register("first_name")}
                  className={errors.first_name ? "border-destructive" : ""}
                />
                {errors.first_name && (
                  <p className="text-sm text-destructive">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия</Label>
                <Input
                  id="last_name"
                  placeholder="Иванов"
                  {...register("last_name")}
                  className={errors.last_name ? "border-destructive" : ""}
                />
                {errors.last_name && (
                  <p className="text-sm text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Введите email"
                {...register("email")}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            {/* Пароль */}
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                placeholder="Минимум 8 символов"
                {...register("password")}
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Пароль должен содержать минимум 8 символов, заглавную букву и специальный символ (!@#$%^&* и т.д.)
              </p>
            </div>

            {/* Принятие условий */}
            <div className="space-y-2">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={watch("terms_accepted")}
                  onCheckedChange={(checked) => {
                    setValue("terms_accepted", checked === true, { shouldValidate: true })
                  }}
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm leading-5 cursor-pointer">
                  Я принимаю{" "}
                  <Link href="/terms" className="text-primary hover:underline" target="_blank">
                    условия использования
                  </Link>{" "}
                  и{" "}
                  <Link href="/privacy" className="text-primary hover:underline" target="_blank">
                    политику конфиденциальности
                  </Link>
                </Label>
              </div>
              {errors.terms_accepted && (
                <p className="text-sm text-destructive">{errors.terms_accepted.message}</p>
              )}
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting || !isValid}>
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
          </Button>
        </form>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Уже есть аккаунт?{" "}
            <Link href="/login" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  )
}

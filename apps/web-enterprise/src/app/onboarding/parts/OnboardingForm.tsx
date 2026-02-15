'use client'

import { useMemo, useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { OnboardingAPI } from '@/lib/api/onboarding'
import { useToast } from '@/components/ui/use-toast'
import { CompanyAPI } from '@/lib/api/company'

// =====================
// Schema & Types
// =====================

// Валидация адреса с проверкой почтовых индексов по странам
const addressSchema = z
  .object({
    line1: z.string().optional().or(z.literal('')),
    line2: z.string().optional().or(z.literal('')),
    city: z.string().optional().or(z.literal('')),
    region: z.string().optional().or(z.literal('')),
    country: z
      .string()
      .length(2, 'Двухбуквенный ISO код')
      .toUpperCase()
      .optional()
      .or(z.literal('')),
    postal_code: z.string().optional().or(z.literal('')),
  })
  .refine((data) => {
    // Валидация почтового индекса в зависимости от страны
    if (data.country && data.postal_code?.trim()) {
      const postal = data.postal_code.trim()
      if (data.country === 'PL') {
        return /^\d{2}-\d{3}$/.test(postal) // польский формат: 00-000
      }
      if (data.country === 'US') {
        return /^\d{5}(-\d{4})?$/.test(postal) // US: 12345 или 12345-6789
      }
      if (data.country === 'UA') {
        return /^\d{5}$/.test(postal) // украинский: 12345
      }
    }
    return true
  }, {
    message: 'Неверный формат почтового индекса для указанной страны',
    path: ['postal_code']
  })
  .optional()

export const onboardingSchema = z.object({
  name: z.string().min(2, 'Минимум 2 символа').max(150, 'Максимум 150 символов'),
  description: z.string().max(1000, 'Максимум 1000 символов').optional().or(z.literal('')),
  industry: z.enum(['retail', 'it', 'marketing', 'education', 'other']).optional().or(z.literal('')),
  size: z.enum(['small', 'medium']).default('small'),
  address: addressSchema,
  preferences: z
    .object({
      timezone: z.string().optional(),
      currency: z.enum(['PLN', 'USD', 'EUR']).optional(),
      locale: z.enum(['pl-PL', 'en-US', 'ru-RU']).optional(),
      week_start: z.enum(['monday', 'sunday']).optional(),
    })
    .optional(),
  custom_fields: z.record(z.unknown()).optional(),
})

export type OnboardingFormValues = z.input<typeof onboardingSchema>

// =====================
// Helper Functions
// =====================

// Функция генерации slug (как на бэкенде)
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80)
}

// Нормализация payload - используем все поля согласно расширенной схеме
function normalizePayload(values: OnboardingFormValues) {
  const trim = (v?: string | null) => (v ? v.trim() : undefined)
  
  const addr = values.address
    ? {
        line1: trim(values.address.line1 || undefined),
        line2: trim(values.address.line2 || undefined),
        city: trim(values.address.city || undefined),
        region: trim(values.address.region || undefined),
        postal_code: trim(values.address.postal_code || undefined),
        country: trim(values.address.country || undefined)?.toUpperCase(),
      }
    : undefined

  const prefs = values.preferences
    ? {
        timezone: trim(values.preferences.timezone || undefined),
        currency: values.preferences.currency,
        locale: values.preferences.locale,
        week_start: values.preferences.week_start,
      }
    : undefined

  const customFields = values.custom_fields 
    ? Object.fromEntries(
        Object.entries(values.custom_fields)
          .filter(([, value]) => value && String(value).trim())
          .map(([key, value]) => [key, String(value).trim()])
      )
    : undefined

  const name = values.name.trim()

  return {
    name,
    slug: generateSlug(name), // автогенерация slug
    description: trim(values.description || undefined),
    industry: values.industry || undefined,
    size: values.size,
    address: addr,
    preferences: prefs,
    custom_fields: customFields,
  }
}

// =====================
// Main Component
// =====================

export default function OnboardingForm({
  onSubmit,
  submitting,
  className,
}: {
  onSubmit?: (values: OnboardingFormValues) => Promise<void> | void
  submitting?: boolean
  className?: string
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [submittingInternal, setSubmittingInternal] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
    setValue,
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onChange',
    defaultValues: {
      size: 'small',
      preferences: {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw',
        currency: 'PLN',
        locale: navigator.language.startsWith('ru') ? 'ru-RU' : 
                navigator.language.startsWith('pl') ? 'pl-PL' : 'en-US',
        week_start: 'monday',
      },
      address: {
        country: 'PL',
      },
      custom_fields: {},
    },
  })

  // Предзаполнение из профиля пользователя
  useEffect(() => {
    const loadUserProfile = async () => {
      try {
        const membership = await CompanyAPI.getCurrentMembership()
        const user = membership?.user
        if (!user) return
        // Предзаполняем данные из профиля
        if (user.timezone) {
          setValue('preferences.timezone', user.timezone)
        }
        if (user.language) {
          const localeMap: Record<string, 'pl-PL' | 'en-US' | 'ru-RU'> = {
            'en': 'en-US',
            'pl': 'pl-PL', 
            'ru': 'ru-RU'
          }
          const locale = localeMap[user.language] || 'en-US'
          setValue('preferences.locale', locale as 'pl-PL' | 'en-US' | 'ru-RU')
        }
      } catch {
        console.warn('Could not load user profile for prefilling')
      }
    }
    
    loadUserProfile()
  }, [setValue])

  const name = watch('name')
  const previewSlug = useMemo(() => name ? generateSlug(name) : '', [name])
  const isBusy = Boolean(submitting) || submittingInternal
  const canSubmit = useMemo(() => isValid && !isBusy, [isValid, isBusy])

  const submitDefault = async (values: OnboardingFormValues) => {
    try {
      setSubmittingInternal(true)
      
      // ✅ Не нужно получать пользователя - бэкенд сам установит owner_id
      
      const payload = normalizePayload(values)
      
      console.log('Sending organization payload:', JSON.stringify(payload, null, 2))
      
      await OnboardingAPI.createOrganization(payload)
      
      toast({ 
        title: 'Компания создана', 
        description: `Организация "${payload.name}" успешно создана`,
      })
      
      router.replace('/dashboard')
    } catch (e: unknown) {
      console.error('Organization creation error:', e)
      
      // Парсим разные типы ошибок
      let errorMessage = 'Не удалось создать организацию'

      const error = e as {
        response?: { data?: { detail?: unknown }; status?: number }
        message?: string
      }

      if (error?.response?.data) {
        const errorData = error.response.data
        
        // Если это массив ошибок валидации
        if (Array.isArray(errorData.detail)) {
          const validationErrors = errorData.detail
            .map((err: { loc?: string[]; msg?: string }) => `${err.loc?.join('.')}: ${err.msg}`)
            .join(', ')
          errorMessage = `Ошибки валидации: ${validationErrors}`
        }
        // Если это объект с описанием
        else if (errorData.detail) {
          if (typeof errorData.detail === "string") {
            errorMessage = errorData.detail
          } else if (typeof errorData.detail === "object" && errorData.detail !== null) {
            const detailObj = errorData.detail as Record<string, unknown>
            const title = typeof detailObj.title === "string" ? detailObj.title : undefined
            const detail = typeof detailObj.detail === "string" ? detailObj.detail : undefined
            errorMessage = title || detail || errorMessage
          }
        }
        // Проверяем статус код
        else if (error.response?.status === 409) {
          errorMessage = 'Организация с таким названием уже существует'
        }
        else if (error.response?.status === 403) {
          errorMessage = 'Недостаточно прав для создания организации'
        }
      }
      // Сетевые ошибки
      else if (error?.message) {
        errorMessage = error.message
      }
      
      toast({ 
        title: 'Ошибка', 
        description: errorMessage, 
        variant: 'destructive' 
      })
    } finally {
      setSubmittingInternal(false)
    }
  }

  const onValid = onSubmit ? onSubmit : submitDefault

  return (
    <form
      className={cn('space-y-8 rounded-lg border bg-card p-6 shadow-sm', className)}
      onSubmit={handleSubmit(onValid)}
      aria-busy={isBusy}
    >
      {/* Основное */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Основная информация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium" htmlFor="org-name">
              Название компании *
            </label>
            <input
              id="org-name"
              type="text"
              {...register('name')}
              placeholder="Например, Liderix Sp. z o.o."
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            
            {/* Предпросмотр slug */}
            {name && (
              <div className="mt-2 rounded-md bg-muted p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">URL:</span>
                  <code className="font-mono text-xs bg-background px-2 py-1 rounded">
                    your-domain.com/org/{previewSlug}
                  </code>
                </div>
                {previewSlug !== name.toLowerCase() && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Название будет преобразовано в URL-дружественный формат
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium" htmlFor="org-desc">
              Описание
            </label>
            <textarea
              id="org-desc"
              rows={3}
              {...register('description')}
              placeholder="Коротко о компании (необязательно)"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="org-industry">
              Индустрия
            </label>
            <select
              id="org-industry"
              {...register('industry')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">—</option>
              <option value="retail">Retail</option>
              <option value="it">IT</option>
              <option value="marketing">Marketing</option>
              <option value="education">Education</option>
              <option value="other">Other</option>
            </select>
            {errors.industry && (
              <p className="mt-1 text-xs text-destructive">{errors.industry.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="org-size">
              Размер
            </label>
            <select
              id="org-size"
              {...register('size')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="small">Small (до 50)</option>
              <option value="medium">Medium (50+)</option>
            </select>
            {errors.size && <p className="mt-1 text-xs text-destructive">{errors.size.message}</p>}
          </div>
        </div>
      </section>

      {/* Дополнительная информация */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Дополнительная информация</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Веб-сайт</label>
            <input
              type="url"
              {...register('custom_fields.website')}
              placeholder="https://company.com"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Телефон</label>
            <input
              type="tel"
              {...register('custom_fields.phone')}
              placeholder="+48 123 456 789"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">ИНН/НИП</label>
            <input
              type="text"
              {...register('custom_fields.tax_id')}
              placeholder="1234567890"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Количество сотрудников</label>
            <input
              type="number"
              min="1"
              {...register('custom_fields.employee_count', { valueAsNumber: true })}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Адрес */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Адрес (необязательно)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-country">
              Страна (ISO-2)
            </label>
            <input
              id="addr-country"
              type="text"
              {...register('address.country')}
              placeholder="PL / UA / US"
              maxLength={2}
              className="w-full rounded-md border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.address?.country && (
              <p className="mt-1 text-xs text-destructive">{errors.address.country.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-region">
              Регион
            </label>
            <input
              id="addr-region"
              type="text"
              {...register('address.region')}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-city">
              Город
            </label>
            <input
              id="addr-city"
              type="text"
              {...register('address.city')}
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-postal">
              Почтовый индекс
            </label>
            <input
              id="addr-postal"
              type="text"
              {...register('address.postal_code')}
              placeholder="00-000 (для PL)"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
            {errors.address?.postal_code && (
              <p className="mt-1 text-xs text-destructive">{errors.address.postal_code.message}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-line1">
              Адрес, строка 1
            </label>
            <input
              id="addr-line1"
              type="text"
              {...register('address.line1')}
              placeholder="ул. Главная, д. 123"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium" htmlFor="addr-line2">
              Адрес, строка 2
            </label>
            <input
              id="addr-line2"
              type="text"
              {...register('address.line2')}
              placeholder="офис 456"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      </section>

      {/* Предпочтения */}
      <section className="space-y-4">
        <h2 className="text-lg font-medium">Настройки по умолчанию</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="pref-tz">
              Часовой пояс
            </label>
            <input
              id="pref-tz"
              type="text"
              {...register('preferences.timezone')}
              placeholder="Europe/Warsaw"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="pref-currency">
              Валюта
            </label>
            <select
              id="pref-currency"
              {...register('preferences.currency')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="PLN">PLN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="pref-locale">
              Язык интерфейса
            </label>
            <select
              id="pref-locale"
              {...register('preferences.locale')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="pl-PL">Polski</option>
              <option value="en-US">English</option>
              <option value="ru-RU">Русский</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="pref-week">
              Первый день недели
            </label>
            <select
              id="pref-week"
              {...register('preferences.week_start')}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="monday">Понедельник</option>
              <option value="sunday">Воскресенье</option>
            </select>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="flex items-center justify-between border-t pt-6">
        <div className="text-xs text-muted-foreground">
          {name ? (
            <div>
              <div>Будет создана компания: <b>&quot;{name}&quot;</b></div>
              <div className="mt-1">URL: <code>your-domain.com/org/{previewSlug}</code></div>
            </div>
          ) : (
            'Укажите название компании'
          )}
        </div>
        <button
          type="submit"
          disabled={!canSubmit}
          className={cn(
            'inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity',
            !canSubmit && 'opacity-60'
          )}
          aria-disabled={!canSubmit}
        >
          {isBusy ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Создаём…
            </>
          ) : (
            'Создать компанию'
          )}
        </button>
      </div>
    </form>
  )
}

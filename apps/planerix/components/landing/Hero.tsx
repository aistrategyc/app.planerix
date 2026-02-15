"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Hero() {
  return (
    <section className="text-center py-24 px-6 bg-gradient-to-b from-gray-50 to-white">
      <h1 className="text-5xl font-bold mb-6">Управляй бизнесом с LIDERIX</h1>
      <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
        Операционная система для бизнеса: стратегия, аналитика, команды и AI.
      </p>
      <div className="flex justify-center gap-4">
        <Link href="https://app.planerix.com/login">
          <Button size="lg">Войти</Button>
        </Link>
        <Link href="https://app.planerix.com/register">
          <Button size="lg" variant="outline">Регистрация</Button>
        </Link>
      </div>
    </section>
  )
}
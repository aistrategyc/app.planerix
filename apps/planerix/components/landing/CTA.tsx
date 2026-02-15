"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export default function CTA() {
  return (
    <section className="py-20 px-6 text-center bg-black text-white">
      <h2 className="text-4xl font-bold mb-4">Готовы начать?</h2>
      <p className="mb-8 text-lg text-gray-300">Подключите LIDERIX и управляйте бизнесом с AI-помощью уже сегодня.</p>
      <Link href="https://app.planerix.com/register">
        <Button size="lg" variant="secondary">
          Зарегистрироваться <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </Link>
    </section>
  )
}
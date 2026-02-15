"use client"

const features = [
  { title: "OKR и стратегия", desc: "Выстраивай цели и приоритеты для команды." },
  { title: "Проекты и задачи", desc: "Эффективное управление рабочими процессами." },
  { title: "CRM и воронки", desc: "Продавай осознанно, контролируя каждый этап." },
  { title: "Маркетинг и гипотезы", desc: "Запускай гипотезы и считай ROI в один клик." },
  { title: "AI-инсайты", desc: "Автоматическая аналитика и рекомендации." },
  { title: "Команды и роли", desc: "Права доступа, рост сотрудников и структура." },
]

export default function Features() {
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto" id="features">
      <h2 className="text-3xl font-bold text-center mb-10">Возможности</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ title, desc }) => (
          <div key={title} className="border p-6 rounded-md shadow-sm hover:shadow-md transition">
            <h3 className="text-xl font-semibold mb-2">{title}</h3>
            <p className="text-gray-600 text-sm">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
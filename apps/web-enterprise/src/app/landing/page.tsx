"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, Play, Star, Check, X, Menu, ArrowRight, Phone, Mail, MapPin, Facebook, Twitter, Linkedin, Youtube, Target, Brain, Users, BarChart3, Briefcase, TrendingUp, Calendar, DollarSign, Shield, Zap, Award, Clock, ChevronRight, Sparkles, Rocket, Building2, GraduationCap, ShoppingCart, Code2, Megaphone } from 'lucide-react';

export default function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const stats = [
    { value: '1M+', label: 'Активных пользователей' },
    { value: '50K+', label: 'Компаний-клиентов' },
    { value: '99.9%', label: 'Uptime сервиса' },
    { value: '4.9/5', label: 'Средняя оценка' }
  ];

  const features = [
    {
      icon: Target,
      title: 'OKR и стратегия',
      description: 'Ставьте амбициозные цели и отслеживайте прогресс. Каскадируйте OKR на все уровни компании.',
      color: 'from-indigo-500 to-purple-600',
      bgColor: 'from-indigo-100 to-purple-100',
      items: ['Каскадирование целей', 'Визуализация прогресса', 'Квартальные циклы']
    },
    {
      icon: Briefcase,
      title: 'Проекты и задачи',
      description: 'Управляйте проектами любой сложности. Kanban, Gantt, спринты — всё в одном месте.',
      color: 'from-blue-500 to-cyan-600',
      bgColor: 'from-blue-100 to-cyan-100',
      items: ['Гибкие методологии', 'Автоматизация процессов', 'Шаблоны проектов']
    },
    {
      icon: Brain,
      title: 'AI-аналитика',
      description: 'Искусственный интеллект анализирует данные и предлагает решения для роста бизнеса.',
      color: 'from-purple-500 to-pink-600',
      bgColor: 'from-purple-100 to-pink-100',
      items: ['Прогнозирование трендов', 'Умные рекомендации', 'Анализ рисков']
    },
    {
      icon: Users,
      title: 'CRM и продажи',
      description: 'Полный цикл работы с клиентами. От первого касания до повторных продаж.',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'from-green-100 to-emerald-100',
      items: ['Воронки продаж', 'История взаимодействий', 'Автоматизация']
    },
    {
      icon: Award,
      title: 'Команда и HR',
      description: 'Управление талантами, развитие сотрудников и построение сильной корпоративной культуры.',
      color: 'from-orange-500 to-amber-600',
      bgColor: 'from-orange-100 to-amber-100',
      items: ['1-on-1 встречи', 'Оценка компетенций', 'Карьерные треки']
    },
    {
      icon: BarChart3,
      title: 'Финансы и бюджеты',
      description: 'Контролируйте финансовые потоки, планируйте бюджеты и отслеживайте эффективность.',
      color: 'from-red-500 to-rose-600',
      bgColor: 'from-red-100 to-rose-100',
      items: ['P&L в реальном времени', 'Бюджетирование', 'Финансовые отчеты']
    }
  ];

  const pricing = [
    {
      name: 'Базовый',
      price: '0',
      description: 'Для небольших команд и стартапов',
      features: [
        { name: 'До 5 пользователей', included: true },
        { name: 'Базовые модули (OKR, задачи)', included: true },
        { name: '1 ГБ хранилища', included: true },
        { name: 'Email поддержка', included: true },
        { name: 'AI-аналитика', included: false },
        { name: 'API доступ', included: false }
      ],
      cta: 'Начать бесплатно',
      popular: false
    },
    {
      name: 'Команда',
      price: '1,900',
      description: 'Для растущих компаний',
      features: [
        { name: 'До 50 пользователей', included: true },
        { name: 'Все основные модули', included: true },
        { name: '100 ГБ хранилища', included: true },
        { name: 'Приоритетная поддержка', included: true },
        { name: 'AI-аналитика базовая', included: true },
        { name: 'API доступ', included: true }
      ],
      cta: 'Попробовать 14 дней',
      popular: true
    },
    {
      name: 'Премиум',
      price: '4,900',
      description: 'Для больших организаций',
      features: [
        { name: 'Неограниченно пользователей', included: true },
        { name: 'Все модули + кастомизация', included: true },
        { name: 'Неограниченное хранилище', included: true },
        { name: 'Персональный менеджер', included: true },
        { name: 'AI-аналитика продвинутая', included: true },
        { name: 'Белый лейбл опция', included: true }
      ],
      cta: 'Связаться с нами',
      popular: false
    }
  ];

  const testimonials = [
    {
      text: "LIDERIX полностью изменил подход к управлению нашими проектами. Теперь все процессы прозрачны, а команда работает как единый организм.",
      author: "Анна Петрова",
      position: "CEO, TechStart",
      rating: 5
    },
    {
      text: "AI-рекомендации помогли нам увеличить конверсию на 40%. Это не просто CRM, а настоящий помощник в развитии бизнеса.",
      author: "Михаил Козлов",
      position: "CMO, E-Commerce Pro",
      rating: 5
    },
    {
      text: "Внедрение OKR через LIDERIX позволило нам масштабироваться в 3 раза за год, сохранив фокус на главных целях.",
      author: "Елена Сидорова",
      position: "COO, FinTech Solutions",
      rating: 5
    }
  ];

  const faqs = [
    {
      question: 'Можно ли попробовать LIDERIX бесплатно?',
      answer: 'Да, вы можете использовать базовый тариф бесплатно без ограничений по времени. Также доступен 14-дневный пробный период для тарифа "Команда" без привязки карты.'
    },
    {
      question: 'Как происходит миграция данных из других систем?',
      answer: 'Мы поддерживаем импорт из популярных CRM и систем управления проектами. Наша команда поможет с переносом данных и настройкой интеграций.'
    },
    {
      question: 'Насколько безопасны мои данные?',
      answer: 'Мы используем шифрование банковского уровня, регулярные бэкапы и соответствуем стандартам GDPR. Ваши данные хранятся в защищенных дата-центрах с сертификацией ISO 27001.'
    },
    {
      question: 'Есть ли мобильное приложение?',
      answer: 'Да, LIDERIX доступен на iOS и Android. Мобильные приложения синхронизируются с веб-версией и поддерживают все основные функции для работы в пути.'
    }
  ];

  const industries = [
    { icon: ShoppingCart, name: 'Retail & E-commerce', description: 'Управление ассортиментом, аналитика продаж' },
    { icon: Code2, name: 'IT & Software', description: 'Agile-процессы, управление разработкой' },
    { icon: Megaphone, name: 'Marketing & PR', description: 'Кампании, контент-планы, метрики' },
    { icon: GraduationCap, name: 'Education & Training', description: 'Курсы, программы обучения, прогресс' }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-white/80 backdrop-blur-sm'
      }`}>
        <nav className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <img
                src="/planerixlogoicon.png"
                alt="Planerix logo"
                className="w-10 h-10 object-contain"
              />
              <span className="text-2xl font-bold">LIDERIX</span>
            </div>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">Возможности</a>
              <a href="#solutions" className="text-slate-600 hover:text-slate-900 transition-colors">Решения</a>
              <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">Тарифы</a>
              <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors">Отзывы</a>
              <a href="#contact" className="text-slate-600 hover:text-slate-900 transition-colors">Контакты</a>
            </div>
            
            <div className="flex items-center space-x-4">
              <button className="hidden md:block text-slate-600 hover:text-slate-900 transition-colors">
                Вход
              </button>
              <button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300 transform hover:scale-105">
                Начать бесплатно
              </button>
              <button 
                className="md:hidden text-slate-600"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 overflow-hidden">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center px-4 py-2 bg-purple-100 rounded-full">
                <span className="relative flex h-2 w-2 mr-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-purple-800 text-sm font-medium">Новое: AI-аналитика уже доступна</span>
              </div>
              
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Управляй бизнесом в
                <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"> едином пространстве</span>
              </h1>
              
              <p className="text-xl text-slate-600 leading-relaxed">
                LIDERIX объединяет стратегию, проекты, команду и аналитику. 
                Всё что нужно для роста бизнеса — в одной системе.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="group relative px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium overflow-hidden transition-all duration-300 transform hover:scale-105 hover:shadow-xl">
                  <span className="relative z-10">Попробовать 14 дней бесплатно</span>
                  <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                </button>
                <button className="flex items-center justify-center px-8 py-4 border-2 border-slate-300 rounded-lg font-medium hover:border-gray-400 transition-colors">
                  <Play className="w-5 h-5 mr-2" />
                  Смотреть демо
                </button>
              </div>
              
              <div className="flex items-center gap-8">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 border-2 border-white flex items-center justify-center text-white font-semibold text-sm">
                      {String.fromCharCode(65 + i)}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-slate-600">1000+ компаний уже с нами</p>
                </div>
              </div>
            </div>
            
            <div className="relative lg:pl-12">
              <div className="relative z-10 animate-float">
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-2xl p-8 text-white">
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold mb-2">Dashboard Preview</h3>
                    <p className="text-indigo-200">Ваш командный центр управления</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['Выручка: +34%', 'Проекты: 24', 'Команда: 48', 'ROI: 156%'].map((stat, i) => (
                      <div key={i} className="bg-white/10 backdrop-blur rounded-lg p-4">
                        <p className="text-white/80 text-sm">{stat}</p>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Floating cards */}
                <div className="absolute -top-6 -left-6 bg-white p-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Рост выручки</p>
                      <p className="text-lg font-bold">+34%</p>
                    </div>
                  </div>
                </div>
                
                <div className="absolute -bottom-6 -right-6 bg-white p-4 rounded-lg shadow-lg transform hover:scale-105 transition-transform">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Активных команд</p>
                      <p className="text-lg font-bold">248</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Background decoration */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full blur-3xl opacity-50"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <p className="text-center text-slate-500 mb-8">Нам доверяют лидеры рынка</p>
          <div className="flex flex-wrap justify-center items-center gap-12">
            {['Google', 'Microsoft', 'Amazon', 'Apple', 'Meta', 'Spotify'].map((company) => (
              <div key={company} className="text-slate-400 hover:text-slate-600 transition-colors">
                <Building2 className="w-12 h-12" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Все инструменты для роста</h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              От постановки целей до аналитики результатов — управляйте всеми процессами в одном месте
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="group relative bg-white p-8 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${feature.bgColor} rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-opacity`}></div>
                  <div className="relative z-10">
                    <div className={`w-14 h-14 bg-gradient-to-br ${feature.color} rounded-xl flex items-center justify-center mb-6`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-slate-600 mb-4">{feature.description}</p>
                    <ul className="space-y-2 text-sm text-slate-600">
                      {feature.items.map((item, i) => (
                        <li key={i} className="flex items-center">
                          <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-50 to-purple-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Как это работает</h2>
            <p className="text-xl text-slate-600">Начните использовать LIDERIX за 4 простых шага</p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: 1, title: 'Регистрация', desc: 'Создайте аккаунт за 30 секунд. Не нужна кредитная карта.' },
              { step: 2, title: 'Настройка', desc: 'Выберите модули и настройте систему под ваш бизнес.' },
              { step: 3, title: 'Команда', desc: 'Пригласите коллег и распределите роли и доступы.' },
              { step: 4, title: 'Рост', desc: 'Используйте все возможности для масштабирования бизнеса.' }
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="relative inline-block mb-6">
                  <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      {item.step}
                    </span>
                  </div>
                  {index < 3 && (
                    <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 -translate-y-1/2"></div>
                  )}
                </div>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-20 px-6 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Решения для вашей индустрии</h2>
            <p className="text-xl text-slate-600">LIDERIX адаптируется под специфику вашего бизнеса</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {industries.map((industry, index) => {
              const Icon = industry.icon;
              return (
                <div key={index} className="text-center p-6 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer">
                  <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="font-bold mb-2">{industry.name}</h3>
                  <p className="text-sm text-slate-600">{industry.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-5xl font-bold mb-2">{stat.value}</div>
                <p className="text-indigo-100">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-slate-50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Прозрачные тарифы</h2>
            <p className="text-xl text-slate-600">Выберите план, который подходит вашему бизнесу</p>
            <div className="inline-flex items-center mt-6 bg-white rounded-lg p-1 shadow-md">
              <button className="px-6 py-2 rounded-md bg-indigo-600 text-white font-medium">Ежемесячно</button>
              <button className="px-6 py-2 rounded-md text-slate-600 font-medium">Ежегодно (-20%)</button>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricing.map((plan, index) => (
              <div key={index} className={`bg-white rounded-2xl shadow-lg p-8 relative transform hover:scale-105 transition-transform ${
                plan.popular ? 'border-2 border-indigo-500' : ''
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                    Популярный выбор
                  </div>
                )}
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-slate-600 mb-6">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-5xl font-bold">₽{plan.price}</span>
                  <span className="text-slate-600">/месяц</span>
                </div>
                <button className={`w-full py-3 rounded-lg font-medium transition-all duration-300 ${
                  plan.popular
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-lg transform hover:scale-105'
                    : 'border-2 border-slate-300 hover:border-gray-400'
                } mb-8`}>
                  {plan.cta}
                </button>
                <ul className="space-y-4">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-slate-400 mt-0.5 mr-3 flex-shrink-0" />
                      )}
                      <span className={feature.included ? '' : 'text-slate-400'}>{feature.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <p className="text-slate-600 mb-4">Все тарифы включают SSL шифрование, ежедневные бэкапы и обновления</p>
            <a href="#" className="text-indigo-600 font-medium hover:text-indigo-700 inline-flex items-center">
              Сравнить все возможности <ArrowRight className="w-4 h-4 ml-1" />
            </a>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-6 bg-white">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Что говорят наши клиенты</h2>
            <p className="text-xl text-slate-600">Истории успеха компаний, которые выбрали LIDERIX</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-slate-50 p-8 rounded-2xl">
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 italic">"{testimonial.text}"</p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-white font-bold mr-4">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="font-bold">{testimonial.author}</p>
                    <p className="text-sm text-slate-600">{testimonial.position}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Часто задаваемые вопросы</h2>
            <p className="text-xl text-slate-600">Ответы на популярные вопросы о LIDERIX</p>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md overflow-hidden">
                <button
                  className="w-full p-6 text-left font-bold flex justify-between items-center hover:bg-slate-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                >
                  {faq.question}
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${
                    openFaq === index ? 'rotate-180' : ''
                  }`} />
                </button>
                {openFaq === index && (
                  <div className="px-6 pb-6">
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-600 to-purple-700 text-white">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Готовы вывести бизнес на новый уровень?
          </h2>
          <p className="text-xl mb-8 text-indigo-100 max-w-2xl mx-auto">
            Присоединяйтесь к тысячам компаний, которые уже управляют бизнесом эффективнее с LIDERIX
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-white text-indigo-600 rounded-lg font-bold hover:shadow-xl transition-all duration-300 transform hover:scale-105">
              Начать бесплатно
            </button>
            <button className="px-8 py-4 border-2 border-white text-white rounded-lg font-bold hover:bg-white hover:text-indigo-600 transition-all duration-300">
              Заказать демо
            </button>
          </div>
          <p className="mt-6 text-indigo-200 flex items-center justify-center">
            <Shield className="w-5 h-5 mr-2" />
            Без кредитной карты • 14 дней бесплатно
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-6 bg-white">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Остались вопросы?</h2>
            <p className="text-xl text-slate-600">Наша команда готова помочь вам начать работу с LIDERIX</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-2xl font-bold mb-6">Свяжитесь с нами</h3>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                    <Mail className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Email</p>
                    <p className="text-slate-600">hello@liderix.ru</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                    <Phone className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Телефон</p>
                    <p className="text-slate-600">+7 (495) 123-45-67</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mr-4">
                    <MapPin className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium">Офис</p>
                    <p className="text-slate-600">Москва, ул. Примерная, 123</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8">
                <p className="font-medium mb-4">Следите за нами</p>
                <div className="flex space-x-4">
                  <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors">
                    <Facebook className="w-5 h-5 text-slate-600" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors">
                    <Twitter className="w-5 h-5 text-slate-600" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors">
                    <Linkedin className="w-5 h-5 text-slate-600" />
                  </a>
                  <a href="#" className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-indigo-100 transition-colors">
                    <Youtube className="w-5 h-5 text-slate-600" />
                  </a>
                </div>
              </div>
            </div>
            
            <div>
              <form className="space-y-6" onSubmit={(e) => {
                e.preventDefault();
                alert('Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.');
              }}>
                <div>
                  <label className="block text-sm font-medium mb-2">Имя</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors" 
                    placeholder="Иван Иванов"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input 
                    type="email" 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors" 
                    placeholder="ivan@company.ru"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Компания</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors" 
                    placeholder="Название компании"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Сообщение</label>
                  <textarea 
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-colors h-32 resize-none" 
                    placeholder="Расскажите о вашем проекте..."
                  ></textarea>
                </div>
                
                <button 
                  type="submit" 
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                >
                  Отправить сообщение
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-300 py-12 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <img
                  src="/planerixlogoicon.png"
                  alt="Planerix logo"
                  className="w-8 h-8 object-contain"
                />
                <span className="text-xl font-bold text-white">LIDERIX</span>
              </div>
              <p className="text-sm">
                Операционная система для современного бизнеса. Управляйте эффективнее.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Продукт</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Возможности</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Тарифы</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Интеграции</a></li>
                <li><a href="#" className="hover:text-white transition-colors">API</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Компания</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">О нас</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Блог</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Карьера</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Контакты</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-medium mb-4">Поддержка</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">Справочный центр</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Документация</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Вебинары</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Статус системы</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm mb-4 md:mb-0">
              © 2025 LIDERIX. Все права защищены.
            </p>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="hover:text-white transition-colors">Политика конфиденциальности</a>
              <a href="#" className="hover:text-white transition-colors">Условия использования</a>
              <a href="#" className="hover:text-white transition-colors">Cookie</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 md:hidden">
          <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-xl">
            <div className="p-6">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-4 right-4 text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="mt-8 space-y-4">
                <a href="#features" className="block text-slate-600 hover:text-slate-900 transition-colors">Возможности</a>
                <a href="#solutions" className="block text-slate-600 hover:text-slate-900 transition-colors">Решения</a>
                <a href="#pricing" className="block text-slate-600 hover:text-slate-900 transition-colors">Тарифы</a>
                <a href="#testimonials" className="block text-slate-600 hover:text-slate-900 transition-colors">Отзывы</a>
                <a href="#contact" className="block text-slate-600 hover:text-slate-900 transition-colors">Контакты</a>
                <hr className="my-4" />
                <button className="block text-slate-600 hover:text-slate-900 transition-colors">Вход</button>
                <button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-2 rounded-lg hover:shadow-lg transition-all duration-300">
                  Начать бесплатно
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

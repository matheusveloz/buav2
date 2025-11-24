'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'

const plans = [
  {
    name: 'Gratuito',
    price: 'R$ 0',
    period: '/mês',
    features: ['5 vídeos/mês', 'Qualidade básica', 'Marca d\'água', 'Suporte email'],
    cta: 'Começar Grátis',
    highlighted: false
  },
  {
    name: 'Pro',
    price: 'R$ 149',
    period: '/mês',
    features: ['50 vídeos/mês', 'Qualidade HD', 'Sem marca d\'água', 'Avatares premium', 'Suporte prioritário', 'Roteirista IA'],
    cta: 'Começar Agora',
    highlighted: true
  },
  {
    name: 'Empresarial',
    price: 'R$ 399',
    period: '/mês',
    features: ['Vídeos ilimitados', 'Qualidade 4K', 'Avatar personalizado', 'API access', 'Suporte dedicado'],
    cta: 'Falar com Vendas',
    highlighted: false
  }
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-16 sm:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Preços <span className="text-green-600">simples</span>
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto">
            Escolha o plano perfeito para suas necessidades
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative rounded-2xl sm:rounded-3xl p-6 sm:p-8 transition-all ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-green-50 to-white border-2 border-green-500 shadow-2xl shadow-green-500/20 lg:scale-105'
                  : 'bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/10'
              }`}
            >
              {/* Spray effect para card destacado */}
              {plan.highlighted && (
                <>
                  <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-40 h-40 bg-green-400/30 rounded-full blur-[80px] pointer-events-none" />
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-green-600 text-white text-xs sm:text-sm font-semibold px-4 py-1 rounded-full shadow-lg">
                    Mais Popular
                  </div>
                </>
              )}

              <div className="relative">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>

                <ul className="space-y-3 sm:space-y-4 mb-8">
                  {plan.features.map((feature, fIndex) => (
                    <li key={fIndex} className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        plan.highlighted ? 'bg-green-500' : 'bg-green-100'
                      }`}>
                        <Check className={`w-3 h-3 ${plan.highlighted ? 'text-white' : 'text-green-600'}`} />
                      </div>
                      <span className="text-gray-600 text-sm sm:text-base">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`w-full py-3 sm:py-4 rounded-full font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}>
                  {plan.cta}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


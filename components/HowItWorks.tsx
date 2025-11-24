'use client'

import { motion } from 'framer-motion'
import { FileText, Sparkles, Video } from 'lucide-react'

const steps = [
  {
    number: 1,
    icon: FileText,
    title: 'Escreva seu Script',
    description: 'Digite ou use nossa IA para gerar um script persuasivo automaticamente'
  },
  {
    number: 2,
    icon: Sparkles,
    title: 'Escolha seu Avatar',
    description: 'Selecione entre dezenas de avatares realistas ou crie o seu próprio'
  },
  {
    number: 3,
    icon: Video,
    title: 'Gere e Baixe',
    description: 'Clique em gerar e baixe seu vídeo profissional em alta qualidade'
  }
]

export default function HowItWorks() {
  return (
    <section className="py-16 sm:py-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Você está a <span className="text-green-600">3 cliques</span> de distância
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Criar vídeos profissionais nunca foi tão simples. Siga esses passos e tenha
            seu conteúdo pronto em minutos.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center relative"
            >
              <div className="relative mb-6">
                <div className="w-full aspect-[4/3] bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/10 transition-all group">
                  <step.icon className="w-14 h-14 sm:w-16 sm:h-16 text-green-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="absolute -top-3 -left-3 w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl text-white shadow-lg shadow-green-500/30">
                  {step.number}
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-gray-600 text-sm sm:text-base">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


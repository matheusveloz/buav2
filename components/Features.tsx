'use client'

import { motion } from 'framer-motion'
import { Sparkles, Video, Zap, Globe, MessageSquare, FileText } from 'lucide-react'

const features = [
  {
    icon: Sparkles,
    title: 'IA Avançada',
    description: 'Tecnologia de ponta para criar vídeos realistas com avatares de IA'
  },
  {
    icon: Video,
    title: 'Alta Qualidade',
    description: 'Vídeos em alta definição que parecem autênticos'
  },
  {
    icon: Zap,
    title: 'Rápido e Fácil',
    description: 'Crie vídeos profissionais em minutos, não em horas'
  },
  {
    icon: Globe,
    title: 'Mais de 35 Idiomas',
    description: 'Alcance audiências globais com suporte multilíngue'
  },
  {
    icon: MessageSquare,
    title: 'Vídeo com Cabeça Falante',
    description: 'Avatares realistas que falam diretamente com seu público'
  },
  {
    icon: FileText,
    title: 'Roteirista com IA',
    description: 'Gere scripts persuasivos automaticamente'
  },
]

export default function Features() {
  return (
    <section id="features" className="py-16 sm:py-20 px-4 bg-gray-50/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Crie criativos <span className="text-green-600">vencedores</span>
            <br />
            com esses recursos
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/10 transition-all group"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 shadow-lg shadow-green-500/30 group-hover:scale-110 transition-transform">
                <feature.icon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2 sm:mb-3">
                {feature.title}
              </h3>
              <p className="text-gray-600 text-sm sm:text-base">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


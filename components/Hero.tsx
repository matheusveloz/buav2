'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Play } from 'lucide-react'

export default function Hero() {
  return (
    <section className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4">
      <div className="max-w-6xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 rounded-full px-4 py-2 mb-6 sm:mb-8">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-700 text-sm font-medium">+1000 criadores ativos</span>
          </div>

          {/* Título */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">
            Crie Vídeos UGC
            <br />
            <span className="bg-gradient-to-r from-green-500 to-green-600 bg-clip-text text-transparent">
              Que Parecem Reais
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto mb-8 sm:mb-10 px-4">
            Transforme suas ideias em vídeos profissionais com avatares de IA. 
            Crie conteúdo autêntico em minutos, não em dias.
          </p>

          {/* Botões */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 px-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-4 rounded-full font-semibold shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-green-500/40 transition-all flex items-center justify-center gap-2"
            >
              Começar Agora
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto bg-white border-2 border-gray-200 text-gray-700 px-8 py-4 rounded-full font-semibold hover:border-green-500 hover:text-green-600 transition-all flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Ver Demo
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}


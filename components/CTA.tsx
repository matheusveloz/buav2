'use client'

import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

export default function CTA() {
  return (
    <section className="py-16 sm:py-20 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative bg-gradient-to-br from-green-500 to-green-600 rounded-3xl sm:rounded-[40px] p-8 sm:p-12 lg:p-16 text-center overflow-hidden"
        >
          {/* Spray effects */}
          <div className="absolute top-0 right-0 w-60 h-60 bg-white/20 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-green-400/50 rounded-full blur-[60px] pointer-events-none" />
          
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 sm:mb-6">
              Crie seu Avatar de IA
              <br />
              em minutos
            </h2>
            <p className="text-white/90 text-base sm:text-lg max-w-xl mx-auto mb-8">
              Junte-se a milhares de criadores transformando ideias em vídeos incríveis.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="bg-white text-green-600 px-8 sm:px-10 py-4 rounded-full font-semibold text-base sm:text-lg shadow-xl hover:shadow-2xl transition-all inline-flex items-center gap-2"
            >
              Começar Gratuitamente
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  )
}


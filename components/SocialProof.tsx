'use client'

import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Maria Silva',
    role: 'CEO, TechStart',
    img: 'https://i.pravatar.cc/100?img=5',
    text: 'A BUUA revolucionou nossa produção de conteúdo. Criamos vídeos em minutos!'
  },
  {
    name: 'João Santos',
    role: 'Marketing, EcomBrasil',
    img: 'https://i.pravatar.cc/100?img=8',
    text: 'Nosso ROI aumentou 300% desde que começamos a usar avatares de IA.'
  }
]

const stats = [
  { value: '10K+', label: 'Vídeos Criados' },
  { value: '98%', label: 'Satisfação' },
  { value: '35+', label: 'Idiomas' },
]

export default function SocialProof() {
  return (
    <section className="py-16 sm:py-20 px-4 bg-gray-50/50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full px-4 py-2 mb-6 shadow-sm">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="text-gray-600 text-sm font-medium ml-2">4.9/5</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Junte-se a 1000+ marcas
            <br />
            <span className="text-green-600">viralizando com IA</span>
          </h2>
        </motion.div>

        {/* Testimonials Grid */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-4xl mx-auto mb-12">
          {testimonials.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/10 transition-all"
            >
              <div className="flex items-center gap-3 sm:gap-4 mb-4">
                <img 
                  src={item.img}
                  alt={item.name}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full ring-2 ring-green-500/30"
                />
                <div>
                  <h4 className="font-semibold text-gray-900">{item.name}</h4>
                  <p className="text-gray-500 text-sm">{item.role}</p>
                </div>
              </div>
              <p className="text-gray-600">&quot;{item.text}&quot;</p>
              <div className="flex gap-1 mt-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-green-500 text-green-500" />
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="relative inline-block">
                <span className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">{stat.value}</span>
                {/* Glow effect */}
                <span className="absolute inset-0 text-3xl sm:text-4xl lg:text-5xl font-bold text-green-500 blur-2xl opacity-30">{stat.value}</span>
              </div>
              <p className="text-gray-500 text-sm sm:text-base mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}


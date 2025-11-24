'use client'

import { motion } from 'framer-motion'
import { Play, Pause } from 'lucide-react'
import { useRef, useState } from 'react'

const avatars = [
  { id: 1, video: '/lpvideo/1_avatar_wepink.mp4', label: 'Product Review', isVideo: true },
  { id: 2, video: '/lpvideo/avatar2_tutorial.mp4', label: 'Tutorial', isVideo: true },
  { id: 3, video: '/lpvideo/avatar4_unbox.mp4', label: 'Unboxing', isVideo: true },
  { id: 4, video: '/lpvideo/avatar3_depoimento.mp4', label: 'Testemunho', isVideo: true },
  { id: 5, video: '/lpvideo/avatar9_review.mp4', label: 'Review', isVideo: true },
  { id: 6, video: '/lpvideo/video_demo.mp4', label: 'Demo', isVideo: true },
]

export default function VideoGrid() {
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({})
  const [playingWithSound, setPlayingWithSound] = useState<number | null>(null)

  const handlePlayClick = (avatarId: number) => {
    const video = videoRefs.current[avatarId]
    if (!video) return

    // Se é o vídeo que já está tocando com som, pausa e tira o som
    if (playingWithSound === avatarId) {
      video.pause()
      video.muted = true
      video.currentTime = 0
      video.play() // Volta a tocar sem som em loop
      setPlayingWithSound(null)
    } else {
      // Para o vídeo anterior se houver
      if (playingWithSound !== null) {
        const prevVideo = videoRefs.current[playingWithSound]
        if (prevVideo) {
          prevVideo.pause()
          prevVideo.muted = true
          prevVideo.currentTime = 0
          prevVideo.play() // Volta a tocar sem som em loop
        }
      }

      // Inicia o novo vídeo com som
      video.currentTime = 0
      video.muted = false
      video.play()
      setPlayingWithSound(avatarId)
    }
  }
  return (
    <section className="pb-16 sm:pb-20 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4"
        >
          {avatars.map((avatar, index) => (
            <motion.div
              key={avatar.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.1 * index }}
              className="group cursor-pointer"
            >
              <div className="relative aspect-[9/16] rounded-2xl sm:rounded-3xl overflow-hidden bg-white/50 backdrop-blur-sm border border-gray-200/50 shadow-lg shadow-green-500/5 hover:shadow-xl hover:shadow-green-500/20 transition-all duration-300">
                {/* Vídeo */}
                <video 
                  ref={(el) => { videoRefs.current[avatar.id] = el }}
                  src={avatar.video}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                />
                
                {/* Gradiente overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                
                {/* Label Glass */}
                <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-white/80 backdrop-blur-md border border-white/50 px-2 sm:px-3 py-1 rounded-full">
                  <span className="text-gray-800 text-[10px] sm:text-xs font-medium">{avatar.label}</span>
                </div>
                
                {/* Play/Pause button hover */}
                <div 
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer z-10"
                  onClick={() => handlePlayClick(avatar.id)}
                >
                  <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform hover:bg-white">
                    {playingWithSound === avatar.id ? (
                      <Pause className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                    ) : (
                      <Play className="w-5 h-5 sm:w-6 sm:h-6 text-green-600 ml-1" />
                    )}
                  </div>
                </div>
                
                {/* Spray/Glow effect no hover */}
                <div className="absolute inset-0 rounded-2xl sm:rounded-3xl ring-2 ring-transparent group-hover:ring-green-400/50 transition-all duration-300 pointer-events-none" />
                <div className="absolute inset-0 rounded-2xl sm:rounded-3xl opacity-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-green-500/10 to-transparent pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}


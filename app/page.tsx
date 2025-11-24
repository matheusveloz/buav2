import Header from '@/components/Header'
import Hero from '@/components/Hero'
import VideoGrid from '@/components/VideoGrid'
import SocialProof from '@/components/SocialProof'
import HowItWorks from '@/components/HowItWorks'
import Features from '@/components/Features'
import Pricing from '@/components/Pricing'
import CTA from '@/components/CTA'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Spray Effects */}
      <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-green-400/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 -left-40 w-[400px] h-[400px] bg-green-500/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] bg-green-300/20 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10">
        <Header />
        <Hero />
        <VideoGrid />
        <SocialProof />
        <HowItWorks />
        <Features />
        <Pricing />
        <CTA />
        <Footer />
      </div>
    </main>
  )
}

"use client"

import { Camera, Clock, Shield, Star, Zap, Code, BarChart3, Users, Smartphone } from "lucide-react"

const features = [
  {
    title: "Lightning Fast",
    description: "Generate AI visualizations in seconds, not minutes. Real-time processing keeps your customers engaged.",
    icon: <Zap className="h-6 w-6" />
  },
  {
    title: "Enterprise Security",
    description: "SOC 2 compliant with end-to-end encryption. Your data and your customers' data stays secure.",
    icon: <Shield className="h-6 w-6" />
  },
  {
    title: "One-Line Embed",
    description: "Add to your website with a single line of code. No complex setup or technical knowledge required.",
    icon: <Code className="h-6 w-6" />
  },
  {
    title: "Analytics Dashboard",
    description: "Track conversions, engagement, and ROI with our comprehensive analytics suite.",
    icon: <BarChart3 className="h-6 w-6" />
  },
  {
    title: "White-Labeled",
    description: "Customize colors, branding, and messaging to match your brand perfectly.",
    icon: <Users className="h-6 w-6" />
  },
  {
    title: "Mobile Optimized",
    description: "Works seamlessly on all devices. Responsive design ensures great experience everywhere.",
    icon: <Smartphone className="h-6 w-6" />
  }
]

export default function FeaturesSection() {
  return (
    <section className="py-24 md:py-32 px-4 md:px-12 bg-gray-50 dark:bg-gray-950 transition-all duration-500">
      <div className="max-w-6xl mx-auto text-center space-y-12">
        <div className="space-y-6">
          <div className="inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            Features
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight text-gray-900 dark:text-white transition-colors duration-300">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-prose mx-auto text-balance leading-relaxed transition-colors duration-300">
            Our AI widget platform provides all the tools you need to create engaging, 
            conversion-driving experiences for your customers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-8 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300"
            >
              <div className="h-12 w-12 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-6">
                <div className="text-gray-600 dark:text-gray-400">
                  {feature.icon}
                </div>
              </div>
              <h3 className="font-bold text-xl mb-4 text-balance text-gray-900 dark:text-white transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-balance leading-relaxed transition-colors duration-300">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
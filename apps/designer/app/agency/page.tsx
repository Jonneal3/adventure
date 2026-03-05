import { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Settings, 
  Zap, 
  Shield, 
  BarChart3, 
  Headphones,
  CheckCircle,
  ArrowRight,
  Star,
  Briefcase
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Agency Services - Adventure | Custom AI Design Solutions',
  description: 'Get completely custom AI design packages for select businesses. Professional implementation, white-labeling, and dedicated support for agencies and enterprises.',
  keywords: 'agency services, custom AI design, white label, enterprise solutions, professional implementation, dedicated support',
  openGraph: {
    title: 'Agency Services - Adventure',
    description: 'Completely custom AI design packages for select businesses with professional implementation and dedicated support.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Agency Services - Adventure',
    description: 'Completely custom AI design packages for select businesses.',
  },
}

const features = [
  {
    icon: Users,
    title: "Dedicated Account Manager",
    description: "Personal point of contact for all your needs and questions"
  },
  {
    icon: Settings,
    title: "Custom Implementation",
    description: "Tailored setup and configuration for your specific business"
  },
  {
    icon: Zap,
    title: "White Label Solutions",
    description: "Brand the platform with your own logo and colors"
  },
  {
    icon: Shield,
    title: "Priority Support",
    description: "24/7 dedicated support with guaranteed response times"
  },
  {
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Comprehensive reporting and performance insights"
  },
  {
    icon: Headphones,
    title: "Training & Onboarding",
    description: "Complete team training and system onboarding"
  }
]

const testimonials = [
  {
    name: "Sarah Johnson",
    role: "Marketing Director",
    company: "Elite Salon Group",
    content: "Adventure's agency team transformed our entire digital presence. The custom implementation perfectly matches our brand and the dedicated support is incredible.",
    rating: 5
  },
  {
    name: "Michael Chen",
    role: "CEO",
    company: "Urban Interiors",
    content: "The white-label solution allowed us to offer premium AI design services under our own brand. ROI was immediate and substantial.",
    rating: 5
  },
  {
    name: "Lisa Rodriguez",
    role: "Operations Manager", 
    company: "Fashion Forward Boutiques",
    content: "Professional implementation, comprehensive training, and ongoing support. Adventure's agency service exceeded all expectations.",
    rating: 5
  }
]

export default function AgencyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-500">
      {/* Hero Section */}
      <section className="relative py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <div className="mb-8">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 mb-6">
              <Briefcase className="w-4 h-4 mr-2" />
              Agency Services
            </span>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Completely Custom
              <span className="text-purple-600 dark:text-purple-400"> AI Design</span>
              <br />
              Packages
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-8">
              For select businesses who need more than just software. Get professional implementation, 
              white-labeling, and dedicated support tailored to your specific needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">
                  Schedule Consultation
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="px-8 py-3">
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              What's Included in Agency Packages
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Everything you need to succeed with AI-powered design, delivered by our expert team.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Our Agency Process
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              A streamlined approach to getting your custom AI design solution up and running.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Discovery
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                We understand your business needs and design requirements
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Customization
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Tailor the platform to match your brand and specific use cases
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Implementation
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Professional setup and integration with your existing systems
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Ongoing training, optimization, and dedicated support
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-4 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              What Our Agency Clients Say
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Don't just take our word for it. Here's what businesses say about our agency services.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6 italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            Let's discuss how our agency services can transform your business with custom AI design solutions.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3">
                Schedule Free Consultation
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="px-8 py-3">
                View Enterprise Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
} 

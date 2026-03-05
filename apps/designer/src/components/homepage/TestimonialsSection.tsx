"use client"

import TestimonialCard from "./testimonial-card"

const testimonials = [
  {
    quote: "The AI widget transformed our hair salon's booking process. Customers can now visualize different styles before booking, leading to 40% more appointments.",
    author: "Sarah Johnson",
    role: "Hair Salon Owner",
    avatarUrl: "/homepage/example0001.png"
  },
  {
    quote: "As a furniture store, the AI visualization widget helped customers see how pieces would look in their space. Our conversion rate increased by 60%.",
    author: "Michael Chen",
    role: "Furniture Store Manager",
    avatarUrl: "/homepage/example0002.png"
  },
  {
    quote: "The AI widget integration was seamless. Our fashion boutique now offers virtual try-ons, and customers love the personalized experience.",
    author: "Mark Williams",
    role: "Fashion Boutique Owner",
    avatarUrl: "/homepage/example0003.png"
  }
]

export default function TestimonialsSection() {
  return (
    <section className="py-24 md:py-32 px-4 md:px-12 bg-gray-50 dark:bg-gray-950 transition-all duration-500">
      <div className="max-w-6xl mx-auto text-center space-y-12">
        <div className="space-y-6">
          <div className="inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            Testimonials
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight text-gray-900 dark:text-white transition-colors duration-300">
            What Our Users Say
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-prose mx-auto text-balance leading-relaxed transition-colors duration-300">
            Thousands of businesses have transformed their customer experience with our AI widgets.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <div key={index}>
              <TestimonialCard {...testimonial} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
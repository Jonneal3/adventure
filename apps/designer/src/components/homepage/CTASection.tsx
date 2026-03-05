import Image from "next/image"
import Link from "next/link"
import { Button } from "../ui/button"

const industries = [
  "Hair & Beauty Salons",
  "Fashion E-commerce", 
  "Furniture Brands",
  "Interior Designers",
  "Real Estate Agents",
  "Landscaping Companies"
]

export default function CTASection() {
  return (
    <section className="py-16 md:py-24 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 transition-colors duration-500">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center md:gap-6 mb-12">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl text-white dark:text-gray-900 transition-colors duration-300">
            Make Your Site Interactive, Intelligent, and Unforgettable
          </h2>
          <p className="max-w-[600px] text-gray-300 dark:text-gray-600 transition-colors duration-300">
            Join hundreds of businesses using our AI widget to increase engagement and drive sales — with zero AI setup required.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/auth">
              <Button className="bg-white dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white transition-all duration-300">
                Get the Widget
              </Button>
            </Link>
            <Link href="#demo">
              <Button variant="outline" className="border-white dark:border-gray-700 text-white dark:text-gray-900 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all duration-300">
                See It Live
              </Button>
            </Link>
            <Link href="#pricing">
              <Button variant="outline" className="border-white dark:border-gray-700 text-white dark:text-gray-900 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-all duration-300">
                Book a Demo
              </Button>
            </Link>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h3 className="text-lg font-semibold mb-4 text-white dark:text-gray-900 transition-colors duration-300">Perfect for businesses like:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {industries.map((industry, index) => (
                <div key={index} className="text-sm text-gray-300 dark:text-gray-600 bg-gray-800/50 dark:bg-gray-200/50 rounded-lg p-2 transition-colors duration-300">
                  {industry}
                </div>
              ))}
            </div>
          </div>
          
          <div className="text-center text-sm text-gray-400 dark:text-gray-500 transition-colors duration-300">
            <p className="mb-2">Trusted by businesses worldwide</p>
            <div className="flex justify-center items-center gap-6 opacity-60">
              <span>✓ White-labeled</span>
              <span>✓ One-line embed</span>
              <span>✓ Lead capture built-in</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"

interface FAQItemProps {
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
  index: number
}

function FAQItem({ question, answer, isOpen, onClick, index }: FAQItemProps) {
  return (
    <motion.div
      className="border-b last:border-b-0"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
    >
      <button
        onClick={onClick}
        className="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-primary"
      >
        <span>{question}</span>
        <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pb-4 text-muted-foreground">{answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  const faqs = [
    {
      question: "How does the AI widget work?",
      answer:
        "Our AI widget allows customers to enter text descriptions or upload photos to instantly generate personalized visualizations. The widget is embedded directly on your website and processes requests in real-time, showing customers how products or designs will look before they buy.",
    },
    {
      question: "What types of businesses can use this widget?",
      answer:
        "Perfect for any business that sells visual products or services: hair salons, fashion retailers, furniture stores, interior designers, real estate agents, landscaping companies, cosmetic clinics, and more. If your customers need to visualize before buying, our widget can help.",
    },
    {
      question: "Is the widget truly white-labeled?",
      answer:
        "Yes! The widget appears completely branded to your business. Your logo, colors, and domain are displayed throughout the experience. There's no external branding visible to your customers - it looks like a native part of your website.",
    },
    {
      question: "How do I integrate the widget into my website?",
      answer:
        "Integration is simple with just one line of code. We provide you with an embed script that you add to your website. The widget automatically adapts to your site's design and can be placed anywhere you want customers to interact with it.",
    },
    {
      question: "Can I capture leads from widget interactions?",
      answer:
        "Absolutely! The widget includes built-in lead capture functionality. When customers download or share their generated images, you can optionally collect their email addresses. This data is automatically synced to your CRM or exported as needed.",
    },
    {
      question: "What if I need custom features or integrations?",
      answer:
        "We offer custom development for enterprise clients. Our team can work with you to create specialized features, integrate with your existing systems, or develop custom prompt packs tailored to your specific industry and use case.",
    },
  ]

  return (
    <div className="w-full max-w-3xl mx-auto">
      {faqs.map((faq, index) => (
        <FAQItem
          key={index}
          question={faq.question}
          answer={faq.answer}
          isOpen={openIndex === index}
          onClick={() => setOpenIndex(openIndex === index ? null : index)}
          index={index}
        />
      ))}
    </div>
  )
}


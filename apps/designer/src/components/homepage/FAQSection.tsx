import { Badge } from "../ui/badge"
import FAQAccordion from "./faq-section"

export default function FAQSection() {
  return (
    <section id="faq" className="py-16 md:py-24">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center md:gap-6 mb-12">
          <Badge variant="outline" className="mb-2">
            FAQ
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="max-w-[600px] text-muted-foreground">
            Everything you need to know about our AI widget service.
          </p>
        </div>
        <div className="max-w-4xl mx-auto">
          <FAQAccordion />
        </div>
      </div>
    </section>
  )
}
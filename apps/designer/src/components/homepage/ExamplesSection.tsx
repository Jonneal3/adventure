import Link from "next/link"
import { Button } from "../ui/button"
import { Badge } from "../ui/badge"
import { demoIndustries } from "@/config/demoIndustries"

const examples = demoIndustries.map((industry) => ({
  category: industry.label,
  rows: [
    {
      before: "Static images or generic gallery.",
      after: "Interactive AI-first design experience tied to their answers.",
      prompt: `“Show me a design for ${industry.label.toLowerCase()} that will ${industry.defaultGoal
        .replace("_", " ")
        .toLowerCase()}.”`,
    },
    {
      before: industry.metrics.labelBefore,
      after: industry.metrics.labelAfter,
      prompt: `Widget is embedded in the ${industry.siteContext.toLowerCase()}.`,
    },
  ],
}))

export default function ExamplesSection() {
  return (
    <section id="examples" className="border-t py-16 md:py-24 bg-muted/20">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center md:gap-6 mb-12">
          <Badge variant="outline" className="mb-2">
            See the Results
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            Before & After Transformations
          </h2>
          <p className="max-w-[600px] text-muted-foreground">
            See how our AI widget helps customers visualize products and designs in their space.
          </p>
        </div>
        
        <div className="space-y-12 max-w-6xl mx-auto">
          {examples.map((category, categoryIndex) => (
            <div key={categoryIndex} className="space-y-6">
              <h3 className="text-xl font-semibold text-center">{category.category}</h3>
              <div className="grid gap-6 md:grid-cols-3">
                {category.rows.map((example, exampleIndex) => (
                  <div key={exampleIndex} className="bg-background rounded-lg border p-4 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Before</span>
                        <span>After</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center">
                          <span className="text-xs text-muted-foreground text-center px-2">{example.before}</span>
                        </div>
                        <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800/30 dark:to-gray-700/30 rounded-lg flex items-center justify-center">
                          <span className="text-xs text-gray-900 dark:text-white font-medium text-center px-2">{example.after}</span>
                        </div>
                      </div>
                      <div className="text-xs bg-muted/50 rounded p-2 text-muted-foreground">
                        <span className="font-medium">Prompt:</span> "{example.prompt}"
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-10 flex justify-center">
          <Link href="/auth">
            <Button variant="outline">
              Try the Widget
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
"use client"

import { motion } from "framer-motion"
import { Badge } from "../ui/badge"
import { ArrowRight, Sparkles, Code, Palette, Users } from "lucide-react"

export default function ProcessSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.15
      }
    }
  }

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 40,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.7,
        ease: "easeOut"
      }
    }
  }

  const steps = [
    {
      icon: <Code className="h-[3vh] w-[3vh]" />,
      title: "One-Line Embed",
      description: "Add our widget to your website with a single line of code. No complex setup required.",
      color: "text-gray-900 dark:text-white"
    },
    {
      icon: <Palette className="h-[3vh] w-[3vh]" />,
      title: "Customize & Brand",
      description: "Match your brand colors, logo, and styling. The widget looks like a native part of your site.",
      color: "text-purple-500"
    },
    {
      icon: <Users className="h-[3vh] w-[3vh]" />,
      title: "Customers Generate",
      description: "Visitors type descriptions and instantly see AI-generated visualizations of your products.",
      color: "text-emerald-500"
    },
    {
      icon: <Sparkles className="h-[3vh] w-[3vh]" />,
      title: "Capture Leads",
      description: "When customers download their images, optionally capture their email for follow-up.",
      color: "text-amber-500"
    }
  ]

  return (
    <section className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container px-[5%] mx-auto">
        <motion.div 
          className="mx-auto max-w-[90%] text-center mb-[8vh]"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Badge variant="secondary" className="mb-[2vh] px-[2%] py-[1vh] border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-900/20">
              <Sparkles className="h-[2vh] w-[2vh] mr-[1%]" />
              How It Works
            </Badge>
          </motion.div>
          <motion.h2 
            className="text-[4vh] font-bold tracking-tight sm:text-[5vh] md:text-[6vh] mb-[3vh]"
            variants={itemVariants}
          >
            From Setup to{" "}
            <span className="bg-gradient-to-r from-gray-900 via-gray-600 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white bg-clip-text text-transparent">
              Success
            </span>{" "}
            in Minutes
          </motion.h2>
          <motion.p 
            className="text-[2.2vh] text-muted-foreground max-w-[70%] mx-auto"
            variants={itemVariants}
          >
            Get your AI widget live on your website in under 5 minutes. No technical expertise required.
          </motion.p>
        </motion.div>

        <motion.div 
          className="grid gap-[4vh] md:grid-cols-2 lg:grid-cols-4"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              className="relative"
              variants={itemVariants}
            >
              <div className="bg-white dark:bg-slate-800 rounded-lg p-[3vh] shadow-lg border border-border/50">
                <div className={`w-[6vh] h-[6vh] rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mb-[2vh] ${step.color}`}>
                  {step.icon}
                </div>
                <h3 className="text-[2.2vh] font-semibold mb-[1vh]">{step.title}</h3>
                <p className="text-muted-foreground text-[1.5vh]">{step.description}</p>
              </div>
              
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-[2vh] transform -translate-y-1/2">
                  <ArrowRight className="h-[3vh] w-[3vh] text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          className="mt-[6vh] text-center"
          variants={itemVariants}
          initial="hidden"
          animate="visible"
        >
          <p className="text-[1.5vh] text-muted-foreground">
            Ready to transform your customer experience? Start your free trial today.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

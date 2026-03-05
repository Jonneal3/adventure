"use client"

import CompanyLogos from "./company-logos"
import { motion } from "framer-motion"

export default function BrandsSection() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.8,
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 30,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  }

  return (
    <section className="h-screen flex items-center justify-center border-y bg-muted/40">
      <div className="container px-[5%] mx-auto">
        <motion.div 
          className="flex flex-col items-center justify-center gap-[3vh] text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.h2 
            className="text-[3vh] font-medium text-muted-foreground"
            variants={itemVariants}
          >
            Trusted by professionals from
          </motion.h2>
          <motion.div
            variants={itemVariants}
          >
            <CompanyLogos />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
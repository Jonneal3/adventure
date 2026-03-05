"use client";

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Quote } from 'lucide-react';
import Image from 'next/image';

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  avatarUrl: string;
}

export default function TestimonialCard({ quote, author, role, avatarUrl }: TestimonialCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
      transition={{ duration: 0.5 }}
      className="border border-gray-200 dark:border-gray-800 p-8 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300"
    >
      <div className="mb-6 flex h-12 w-12 items-center justify-center border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
        <Quote className="h-6 w-6" />
      </div>
      
      <p className="mb-6 text-gray-600 dark:text-gray-400 leading-relaxed text-lg transition-colors duration-300">
        "{quote}"
      </p>
      
      <div className="flex items-center gap-4">
        <div className="relative">
          <Image
            src={avatarUrl || "/placeholder.svg"}
            alt={author}
            width={48}
            height={48}
            className="h-12 w-12 rounded-full object-cover border border-gray-200 dark:border-gray-800"
          />
        </div>
        <div>
          <h4 className="text-base font-bold text-gray-900 dark:text-white transition-colors duration-300">
            {author}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-500 transition-colors duration-300">
            {role}
          </p>
        </div>
      </div>
    </motion.div>
  );
}


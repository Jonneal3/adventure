"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { usePathname } from "next/navigation";

export default function Footer() {
  // Footer disabled - main page should never be scrollable
  return null;

  return (
    <footer className="border-t border-gray-200 dark:border-gray-700 py-12 md:py-16 bg-white dark:bg-black transition-colors duration-300">
      <div className="container px-4 md:px-6">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-gray-900 dark:text-white">
              <Camera className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <span>Adventure</span>
            </Link>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Professional AI-generated headshots for your online presence.
            </p>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Product</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#how-it-works" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="#examples" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Examples
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Pricing
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Company</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#about" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  About
                </Link>
              </li>
              <li>
                <Link href="#contact" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#privacy" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Support</h3>
            <ul className="space-y-2">
              <li>
                <Link href="#help" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="#docs" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#community" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Community
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            © 2024 Adventure. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

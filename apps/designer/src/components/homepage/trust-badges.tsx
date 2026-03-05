import Image from "next/image"
import { Star } from "lucide-react"

export default function TrustBadges() {
  return (
    <div className="flex flex-col items-center space-y-6">
      <div className="flex flex-wrap items-center justify-center gap-6">
        <div className="flex items-center">
          <Image
            src="/icons/google.png"
            alt="Google Reviews"
            width={24}
            height={24}
            className="mr-2"
          />
          <span className="font-medium text-gray-700 dark:text-gray-300">Google Reviews</span>
          <span className="mx-2 font-bold text-gray-900 dark:text-white">4.8</span>
          <div className="flex text-gray-400 dark:text-gray-600">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
        </div>

        <div className="flex items-center">
          <Image src="/icons/trustpilot.png" alt="Trustpilot" width={24} height={24} className="mr-2" />
          <span className="font-medium text-gray-700 dark:text-gray-300">Trustpilot</span>
          <span className="mx-2 font-bold text-gray-900 dark:text-white">4.7</span>
          <div className="flex text-gray-400 dark:text-gray-600">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
        </div>
      </div>

      <p className="text-center font-medium text-gray-600 dark:text-gray-400">
        <span>Trusted by over</span> <span className="font-bold text-gray-900 dark:text-white">100,000+</span>{" "}
        <span>professionals and teams.</span> <span className="font-bold text-gray-900 dark:text-white">5,000,000+</span>{" "}
        <span>headshots generated to date.</span>
      </p>
    </div>
  )
}


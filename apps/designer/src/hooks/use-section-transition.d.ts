export type SectionType = 'hero' | 'brands' | 'process' | 'features' | 'examples' | 'testimonials' | 'pricing' | 'faq' | 'cta';
export interface SectionTransitionOptions {
    duration?: number;
    easing?: string;
}
export declare function useSectionTransition(initialSection?: SectionType): {
    currentSection: SectionType;
    isTransitioning: boolean;
    goToSection: (section: SectionType) => void;
    goToNext: () => void;
    goToPrevious: () => void;
    goToFirst: () => void;
    goToLast: () => void;
    sections: SectionType[];
};

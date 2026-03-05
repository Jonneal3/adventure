export type StripeMode = "test" | "live";
export declare function useStripeMode(): {
    mode: StripeMode;
    setMode: import("react").Dispatch<import("react").SetStateAction<StripeMode>>;
};

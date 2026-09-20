import loaderAsset from "@/assets/universe-casino-loader.gif.asset.json";

type AppLoaderProps = {
  compact?: boolean;
  className?: string;
};

export function AppLoader({ compact = false, className = "" }: AppLoaderProps) {
  return (
    <div
      className={`flex w-full items-center justify-center bg-table-felt ${compact ? "min-h-[150px] py-5" : "min-h-[calc(100dvh-76px)] py-10 sm:min-h-[calc(100dvh-60px)]"} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <img
        src={loaderAsset.url}
        alt="Universe Casino loading"
        className={compact ? "h-auto w-[280px] max-w-[80vw]" : "h-auto w-[min(92vw,640px)]"}
      />
    </div>
  );
}
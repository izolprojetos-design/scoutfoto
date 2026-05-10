import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-20 w-20 p-2.5 ring-4",
  md: "h-24 w-24 p-3 ring-4",
  lg: "h-44 w-44 p-4 ring-4",
};

interface LogoCircleProps {
  size?: Size;
  ringClassName?: string;
  shadowClassName?: string;
  className?: string;
  alt?: string;
}

/**
 * Reusable circular logo badge — shared style between SplashScreen and Login.
 * White background, rounded-full, consistent ring/shadow/padding.
 */
const LogoCircle = ({
  size = "md",
  ringClassName = "ring-white/20",
  shadowClassName = "shadow-xl",
  className,
  alt = "ScoutFoto Logo",
}: LogoCircleProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full overflow-hidden",
        SIZES[size],
        shadowClassName,
        ringClassName,
        className,
      )}
      style={{ backgroundColor: "#0a3d2e" }}
    >
      <img
        src="/scoutfoto-logo.jpeg"
        alt={alt}
        className="w-full h-full object-cover rounded-full scale-150"
      />
    </div>
  );
};

export default LogoCircle;

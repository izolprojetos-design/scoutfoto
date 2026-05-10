import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZES: Record<Size, string> = {
  sm: "h-20 w-20 p-2 ring-4",
  md: "h-24 w-24 p-2.5 ring-4",
  lg: "h-44 w-44 p-3 ring-4",
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
 * Outer ring: white background. Inner: green circle with the icon centered.
 */
const LogoCircle = ({
  size = "md",
  ringClassName = "ring-white/40",
  shadowClassName = "shadow-xl",
  className,
  alt = "ScoutFoto Logo",
}: LogoCircleProps) => {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-white",
        SIZES[size],
        shadowClassName,
        ringClassName,
        className,
      )}
    >
      <div
        className="flex h-full w-full items-center justify-center rounded-full overflow-hidden"
        style={{ backgroundColor: "#0a3d2e" }}
      >
        <img
          src="/scoutfoto-logo.jpeg"
          alt={alt}
          className="w-full h-full object-cover object-center rounded-full"
        />
      </div>
    </div>
  );
};

export default LogoCircle;

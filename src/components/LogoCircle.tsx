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
  /** Gira a flor de lis continuamente (usado durante o carregamento). */
  spinning?: boolean;
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
  spinning = false,
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
        className="flex h-full w-full items-center justify-center rounded-full overflow-hidden p-[10%]"
        style={{ backgroundColor: "#0a3d2e" }}
      >
        <img
          src="/scoutfoto-logo-512.png"
          alt={alt}
          className={cn(
            "w-full h-full object-contain object-center",
            spinning && "[animation:spin_2.5s_linear_infinite]",
          )}
        />
      </div>
    </div>
  );
};


export default LogoCircle;

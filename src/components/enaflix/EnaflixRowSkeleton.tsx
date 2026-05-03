import { CinematicSkeleton } from \"@/components/cinematic/CinematicSkeleton\";

export function EnaflixRowSkeleton() {
  return (
    <div className=\"space-y-4 px-4 sm:px-8 lg:px-14\">
      <div className=\"space-y-2\">
        <CinematicSkeleton module=\"enaflix\" shape=\"rect\" className=\"h-6 w-48\" />
        <CinematicSkeleton module=\"enaflix\" shape=\"rect\" className=\"h-4 w-72 opacity-50\" />
      </div>
      <div className=\"flex gap-4 overflow-hidden\">
        {[1, 2, 3, 4, 5].map((i) => (
          <CinematicSkeleton
            key={i}
            module=\"enaflix\"
            shape=\"card\"
            className=\"shrink-0 w-[240px] sm:w-[280px] aspect-video\"
            delay={i * 100}
          />
        ))}
      </div>
    </div>
  );
}

import { CinematicSkeleton } from "@/components/cinematic/CinematicSkeleton";

export function EnaflixBillboardSkeleton() {
  return (
    <div className="relative w-full h-[78vh] min-h-[520px] max-h-[820px] overflow-hidden bg-[#0a0a12]">
      <div className="relative h-full flex items-end pb-20 sm:pb-28 px-4 sm:px-8 lg:px-14">
        <div className="w-full max-w-2xl space-y-5">
          <CinematicSkeleton module="enaflix" shape="pill" className="h-6 w-48" />
          <CinematicSkeleton module="enaflix" className="h-16 sm:h-24 w-full sm:w-3/4" />
          <div className="space-y-2">
            <CinematicSkeleton module="enaflix" className="h-4 w-full" />
            <CinematicSkeleton module="enaflix" className="h-4 w-5/6" />
          </div>
          <div className="flex gap-3 pt-2">
            <CinematicSkeleton module="enaflix" className="h-12 w-40" />
            <CinematicSkeleton module="enaflix" className="h-12 w-32" />
          </div>
        </div>
      </div>
      <div className="absolute right-0 top-0 h-full w-[60%] lg:w-[50%] p-10 hidden sm:block">
        <CinematicSkeleton module="enaflix" shape="card" className="w-full h-full opacity-20" intensity="soft" />
      </div>
    </div>
  );
}

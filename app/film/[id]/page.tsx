import type {
  CrewMember,
  Film,
  FilmDetail,
  Keyword,
  MovieImage,
  MovieVideo,
  RegionalAvailabilityResponse,
  Review,
} from "@/lib/types";
import Breadcrumb from "@/components/Breadcrumb";
import FilmVideos from "@/components/film/FilmVideos";
import FilmGallery from "@/components/film/FilmGallery";
import FilmRail from "@/components/film/FilmRail";
import FilmReviews from "@/components/film/FilmReviews";
import RegionalAvailability from "@/components/film/RegionalAvailability";
import FilmHeaderInfo from "@/components/film/FilmHeaderInfo";
import FilmCastStrip from "@/components/film/FilmCastStrip";
import FilmCrewGrid from "@/components/film/FilmCrewGrid";
import FilmKeywordChips from "@/components/film/FilmKeywordChips";
import FilmExternalLinks from "@/components/film/FilmExternalLinks";
import FilmDetailsTable from "@/components/film/FilmDetailsTable";
import Image from "next/image";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { tmdbImageUrl, parseTMDBId } from "@/lib/tmdb";

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: "10px",
        fontWeight: 600,
        letterSpacing: "1.8px",
        textTransform: "uppercase",
        color: "var(--t1)",
        marginBottom: "10px",
        transition: "color 0.2s",
      }}
    >
      {children}
    </div>
  );
}

const CREW_DISPLAY_ORDER = [
  "Director",
  "Screenplay",
  "Writer",
  "Story",
  "Director of Photography",
  "Original Music Composer",
];

function sortCrew(crew: CrewMember[]): CrewMember[] {
  return [...crew].sort((a, b) => {
    const ai = CREW_DISPLAY_ORDER.indexOf(a.job);
    const bi = CREW_DISPLAY_ORDER.indexOf(b.job);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

export default async function FilmDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fail fast on malformed ids so we render the framework's not-found page
  // rather than a half-broken detail surface.
  if (parseTMDBId(id) === null) notFound();

  const headersList = await headers();
  const host = headersList.get("host");
  const protocol = host && host.startsWith("localhost") ? "http" : "https";
  const baseUrl = host ? `${protocol}://${host}` : "";

  const [
    detailRes,
    availabilityRes,
    videosRes,
    imagesRes,
    keywordsRes,
    relatedRes,
    reviewsRes,
  ] = await Promise.all([
    fetch(`${baseUrl}/api/movies/${id}`),
    fetch(`${baseUrl}/api/movies/${id}/regional-availability`),
    fetch(`${baseUrl}/api/movies/${id}/videos`),
    fetch(`${baseUrl}/api/movies/${id}/images`),
    fetch(`${baseUrl}/api/movies/${id}/keywords`),
    fetch(`${baseUrl}/api/movies/${id}/related`),
    fetch(`${baseUrl}/api/movies/${id}/reviews`),
  ]);

  // Detail is the load-bearing fetch. 404 => not-found page; other failures
  // bubble up to error.tsx via the throw below.
  if (detailRes.status === 404) notFound();
  if (!detailRes.ok) {
    throw new Error(`Failed to load film ${id}: ${detailRes.status}`);
  }

  const detail: FilmDetail = await detailRes.json();
  const availability: RegionalAvailabilityResponse = await availabilityRes.json();
  const videosData = await videosRes.json();
  const imagesData = await imagesRes.json();
  const keywordsData = await keywordsRes.json();
  const relatedData = await relatedRes.json();
  const reviewsData = await reviewsRes.json();

  const videos: MovieVideo[] = videosData.videos || [];
  const posters: MovieImage[] = imagesData.posters || [];
  const backdrops: MovieImage[] = imagesData.backdrops || [];
  const keywords: Keyword[] = keywordsData.keywords || [];
  const relatedFilms: Film[] = relatedData.films || [];
  const relatedSource: "recommendations" | "similar" =
    relatedData.source ?? "similar";
  const reviews: Review[] = reviewsData.reviews || [];
  const externalIds = detail.external_ids ?? null;

  // Compute country labels server-side — Intl.DisplayNames ICU data differs
  // between Node and the browser ("Hong Kong SAR China" vs "Hong Kong") and
  // would hydration-mismatch.
  const regionCodes = Object.keys(availability.regions ?? {});
  const regionLabels: Record<string, string> = {};
  try {
    const intl = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of regionCodes) {
      regionLabels[code] = intl.of(code) ?? code;
    }
  } catch {
    // Older runtime without DisplayNames — fall back to the raw codes.
    for (const code of regionCodes) regionLabels[code] = code;
  }

  const year = detail.release_date?.slice(0, 4);
  const cast = detail.credits?.cast?.slice(0, 8) ?? [];
  const crew = sortCrew(detail.credits?.crew ?? []);
  const backdropUrl = tmdbImageUrl(detail.backdrop_path, "original");

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style>{`
        .fd-breadcrumb-wrap {
          padding: 14px 28px 0;
          max-width: 1100px;
          margin: 0 auto;
        }
        .fd-backdrop {
          position: relative;
          width: 100%;
          height: 380px;
          background-size: cover;
          background-position: center top;
          overflow: hidden;
        }
        .fd-backdrop-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, var(--bg) 0%, rgba(10,10,12,0.45) 55%, rgba(10,10,12,0.15) 100%);
        }
        [data-theme="light"] .fd-backdrop-overlay {
          background: linear-gradient(to top, var(--bg) 0%, rgba(244,243,238,0.55) 55%, rgba(244,243,238,0.2) 100%);
        }
        .fd-outer {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 28px 60px;
          position: relative;
          z-index: 2;
        }
        .fd-outer.has-backdrop { margin-top: -300px; }
        .fd-outer.no-backdrop  { margin-top: 32px; }
        .fd-grid {
          display: grid;
          grid-template-columns: 240px 1fr;
          gap: 36px;
          align-items: start;
        }
        .fd-sidebar { position: sticky; top: 80px; }
        .fd-poster {
          width: 100%;
          aspect-ratio: 2/3;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3);
          background: var(--surface2);
          position: relative;
        }
        .fd-info { min-width: 0; }

        /* ── Buttons — dark mode default (frosted glass over backdrop) ── */
        .fd-actions { display: flex; flex-direction: column; gap: 8px; }
        .fd-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.25);
          cursor: pointer;
          width: 100%;
          transition: border-color 0.2s, color 0.2s, background 0.2s;
        }
        .fd-btn:hover {
          background: rgba(255, 255, 255, 0.18);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.45);
        }

        /* ── Light mode: match genre tag styling ── */
        [data-theme="light"] .fd-btn {
          background: var(--tag-bg);
          color: var(--t1);
          border: 1px solid var(--tag-border);
        }
        [data-theme="light"] .fd-btn:hover {
          background: var(--surface2);
          color: var(--t1);
          border-color: var(--border-h);
        }

        /* ── Desktop header ── */
        .fd-desktop-header { display: block; margin-bottom: 24px; }
        .fd-mobile-header { display: none; }

        /* ── Tablet (≤ 860px) ── */
        @media (max-width: 860px) {
          .fd-breadcrumb-wrap { padding: 12px 16px 0; }
          .fd-backdrop   { height: 260px; }
          .fd-outer      { padding: 0 16px 40px; }
          .fd-outer.has-backdrop { margin-top: -110px; }
          .fd-grid { grid-template-columns: 1fr; gap: 0; }
          .fd-sidebar {
            position: relative;
            top: auto;
            display: block;
            margin-bottom: 20px;
          }
          .fd-poster { width: 160px; margin: 0 auto 0 0; }
          .fd-desktop-header { display: none; }
          .fd-mobile-header  { display: block; margin-bottom: 16px; }
          .fd-btn {
            background: var(--tag-bg);
            color: var(--t1);
            border: 1px solid var(--tag-border);
          }
          .fd-btn:hover {
            background: var(--surface2);
            color: var(--t1);
            border-color: var(--border-h);
          }
        }

        /* ── Mobile (≤ 500px) ── */
        @media (max-width: 500px) {
          .fd-breadcrumb-wrap { padding: 10px 12px 0; }
          .fd-backdrop   { height: 200px; }
          .fd-outer      { padding: 0 12px 32px; }
          .fd-outer.has-backdrop { margin-top: -80px; }
          .fd-poster { width: 130px; }
        }

        /* ── Cast scroll ── */
        .fd-cast-scroll {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 6px;
          padding-right: 28px;
          min-width: 0;
          max-width: 100%;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .fd-cast-scroll::-webkit-scrollbar       { height: 4px; }
        .fd-cast-scroll::-webkit-scrollbar-track  { background: transparent; }
        .fd-cast-scroll::-webkit-scrollbar-thumb  { background: var(--border-h); border-radius: 2px; }

        /* Right-edge fade — visual hint that a horizontal rail keeps going. */
        .fd-scroll-fade {
          position: relative;
          min-width: 0;
        }
        .fd-scroll-fade::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 6px;
          width: 32px;
          background: linear-gradient(to right, rgba(13, 18, 32, 0) 0%, var(--bg) 100%);
          pointer-events: none;
          z-index: 1;
        }
        [data-theme="light"] .fd-scroll-fade::after {
          background: linear-gradient(to right, rgba(243, 232, 210, 0) 0%, var(--bg) 100%);
        }
      `}</style>

      {backdropUrl ? (
        <div
          className="fd-backdrop"
          style={{ backgroundImage: `url('${backdropUrl}')` }}
        >
          <div className="fd-backdrop-overlay" />
          <div
            className="fd-breadcrumb-wrap"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 2,
            }}
          >
            <Breadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Results", href: "/results" },
                { label: detail.title },
              ]}
            />
          </div>
        </div>
      ) : (
        <div className="fd-breadcrumb-wrap">
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Results", href: "/results" },
              { label: detail.title },
            ]}
          />
        </div>
      )}

      <div
        className={`fd-outer ${backdropUrl ? "has-backdrop" : "no-backdrop"}`}
      >
        <div className="fd-grid">
          {/* ── Sidebar: poster only ── */}
          <div className="fd-sidebar">
            <div className="fd-poster">
              {detail.poster_path ? (
                <Image
                  src={tmdbImageUrl(detail.poster_path, "w500") ?? ""}
                  alt={detail.title}
                  width={500}
                  height={750}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                  priority
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--t3)",
                    fontSize: "13px",
                  }}
                >
                  No Poster
                </div>
              )}
            </div>
          </div>

          {/* ── Info column ── */}
          <div className="fd-info">
            <FilmHeaderInfo
              movieId={detail.id}
              title={detail.title}
              voteAverage={detail.vote_average}
              year={year}
              runtime={detail.runtime}
              genres={detail.genres ?? []}
              posterPath={detail.poster_path}
            />

            {/* Synopsis */}
            <SectionLabel>Synopsis</SectionLabel>
            <p
              style={{
                fontSize: "14px",
                lineHeight: 1.7,
                color: "var(--t1)",
                marginBottom: "28px",
                transition: "color 0.2s",
              }}
            >
              {detail.overview}
            </p>

            {/* Videos */}
            <div style={{ marginBottom: "28px" }}>
              <SectionLabel>Videos</SectionLabel>
              <FilmVideos videos={videos} />
            </div>

            {/* Gallery */}
            {(posters.length > 0 || backdrops.length > 0) && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>Gallery</SectionLabel>
                <FilmGallery
                  posters={posters}
                  backdrops={backdrops}
                  movieTitle={detail.title}
                />
              </div>
            )}

            {/* Where to watch — regional with picker */}
            <div style={{ marginBottom: "28px" }}>
              <SectionLabel>Where to watch</SectionLabel>
              <RegionalAvailability
                data={availability}
                regionLabels={regionLabels}
              />
            </div>

            {/* Cast */}
            {cast.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>Cast</SectionLabel>
                <FilmCastStrip cast={cast} />
              </div>
            )}

            {/* Crew */}
            {crew.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>Crew</SectionLabel>
                <FilmCrewGrid crew={crew} />
              </div>
            )}

            {/* Keywords */}
            {keywords.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>Themes</SectionLabel>
                <FilmKeywordChips keywords={keywords} />
              </div>
            )}

            {/* More like this — recommendations or similar fallback */}
            {relatedFilms.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>
                  {relatedSource === "recommendations"
                    ? "More like this"
                    : "Similar films"}
                </SectionLabel>
                <FilmRail films={relatedFilms} />
              </div>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <div style={{ marginBottom: "28px" }}>
                <SectionLabel>Reviews</SectionLabel>
                <FilmReviews reviews={reviews} />
              </div>
            )}

            {/* External links */}
            {externalIds &&
              (externalIds.imdb_id ||
                externalIds.facebook_id ||
                externalIds.instagram_id ||
                externalIds.twitter_id) && (
                <div style={{ marginBottom: "28px" }}>
                  <SectionLabel>External links</SectionLabel>
                  <FilmExternalLinks externalIds={externalIds} />
                </div>
              )}

            {/* Details table */}
            <div style={{ marginBottom: "28px" }}>
              <SectionLabel>Details</SectionLabel>
              <FilmDetailsTable
                runtime={detail.runtime}
                year={year}
                genres={detail.genres ?? []}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Plain, serialisable view models for the stage pages. Server pages map
 * database rows into these, and the design preview feeds fixtures, so every
 * stage component is presentational and can be rendered without a database.
 */

export type StageDropAvailability =
  | 'on_sale'
  | 'presale'
  | 'not_started'
  | 'ended'
  | 'sold_out'
  | 'unavailable';

export interface StageArtist {
  id: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
}

export interface StageDrop {
  id: string;
  artistId: string;
  artistName: string;
  title: string;
  description: string | null;
  priceType: string;
  /** Dollars. For pay-what-you-want this is the minimum. */
  price: number;
  memberPrice: number | null;
  memberDiscountPercent: number | null;
  startsAt: string;
  presaleStartsAt: string | null;
  endsAt: string | null;
  quantityLimit: number | null;
  remaining: number | null;
  itemCount: number;
  availability: StageDropAvailability;
  /** Artwork to show; the artist's photo when the drop has none. */
  artwork: string | null;
  /** What kind of release this is: music or video, and its format. */
  media: StageMedia;
}

export type StageMediaKind = 'music' | 'video';

/**
 * How a release presents itself. Music shows square artwork; video shows a
 * 16:9 poster and a player slot. Today the kind and format are read from the
 * drop's attached content; an explicit format field can replace that later.
 */
export interface StageMedia {
  kind: StageMediaKind;
  /** Fan-facing format: Single, Project, Short, Film, Documentary, Series. */
  format: string;
  /** 16:9 still for a video release. Null falls back to the artwork. */
  poster: string | null;
  /** Total running time in seconds, when known. */
  runtimeSeconds: number | null;
  /** A public trailer or preview the player may stream. Null shows the poster only. */
  previewUrl: string | null;
}

export interface StageParty {
  id: string;
  title: string;
  description: string | null;
  status: string;
  scheduledAt: string | null;
  thumbnailUrl: string | null;
  /** Dollars as a fixed two-decimal string, as the API returns it. */
  price: string;
  artist: { id: string; displayName: string };
}

export interface StageTier {
  id: string;
  name: string;
  description: string;
  /** Dollars per month. */
  price: number;
}

/** Who is looking, as far as the buy buttons need to know. */
export interface StageViewer {
  signedIn: boolean;
  /** Only fans can buy; artists and admins see a note instead of a button. */
  isFan: boolean;
}

export const isPayWhatYouWant = (drop: Pick<StageDrop, 'priceType'>) =>
  drop.priceType === 'PAY_WHAT_YOU_WANT';

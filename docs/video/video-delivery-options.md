# Video on DirectFanz: what ships now, and the options after it

November 2026. DirectFanz releases music (singles and projects) and creative
video (shorts, music videos, documentaries, films, episodes) through the same
drops, presales, memberships and paywall.

## What ships in this change (no new AWS resources)

- **Upload:** MP4, M4V, MOV and WebM, up to 2,000 MB per file, straight from
  the browser to the private S3 bucket in 16 MB parts. Part links are
  re-signed as the upload goes (`POST /api/upload/parts`), and a failed part
  is retried, so a film on a slow connection doesn't fail when the first
  links expire after 15 minutes.
- **Playback:** progressive MP4. The stream route checks access on every
  request, then redirects to a signed S3 link (1 hour). S3 answers Range
  requests, so seeking works. When a long video outlives its link, the player
  asks the stream route again and resumes at the same second.
- **Poster and runtime:** the uploader grabs a frame a tenth of the way in
  and uploads it as the thumbnail, and saves the runtime. Fans see the still
  and "Documentary · 1:02:05" before they pay.
- **Kind:** artists tag each release as a single, project track, short,
  music video, documentary, film, episode, behind the scenes or live
  performance (stored in `content.metadata` as `kind`).

### Limits of this approach

- One file, one quality. A 1080p film at 3 Mbps needs a steady 3 Mbps
  connection; there is no automatic step down on a weak phone signal.
- Browsers play MP4 (H.264 video, AAC audio) everywhere. Many `.mov` files
  (ProRes, some HEVC) won't play in Chrome or Firefox; the uploader warns.
- 2,000 MB per file, because `content.fileSize` is a 32-bit column. A
  90-minute film exported as H.264 at about 3 Mbps is roughly 2 GB. Raising
  it means a migration to BigInt and a pass over every route that returns
  the row (BigInt doesn't serialise to JSON).
- Viewers download straight from S3, priced as S3 data transfer out.

## Option 1: CloudFront in front of the bucket (cheapest delivery)

Serve the same MP4s through CloudFront with signed URLs instead of S3 links.

- CloudFront's always-free tier covers 1 TB out and 10 million requests a
  month; after that it is $0.085 per GB in the US (first 10 TB).
- S3 straight to viewers is about $0.09 per GB, with only 100 GB a month free
  across the account.
- Example: a 90-minute film at 2 GB watched once by 300 fans is 600 GB. From
  S3 that's roughly $45 to $55; through CloudFront it's inside the free 1 TB.
- Work: a distribution with origin access control and a key group in PR #56,
  one private key secret, and a small change to `redirectToObject` to sign
  CloudFront links. No change to uploads or the paywall.
- Monthly cost at launch volumes: about $0 to $1.

This is the first upgrade to make once video drops are selling.

## Option 2: transcoding to HLS with AWS Elemental MediaConvert

Turn each upload into an adaptive HLS ladder (for example 1080p, 720p and
480p) so playback steps down on weak connections, and any source format
(MOV, ProRes, HEVC) plays everywhere.

- Pricing is per normalised output minute. On-demand Basic tier: $0.0075
  per normalised minute; Professional: $0.0120 (US East rates from the AWS
  pricing page's examples). With AVC, SD counts 1x and HD 2x.
- A 1080p + 720p + 480p ladder is 5 normalised minutes per source minute:
  about $0.04 per minute of video (Basic) or $0.06 (Professional).
- Example month with 4 hours of new video: about $9 (Basic) or $14
  (Professional). It's paid once per upload, not per view.
- Storage grows by roughly the size of the renditions (S3 Standard is about
  $0.023 per GB-month, so 20 GB of extra renditions is about $0.50 a month).
- Work: a MediaConvert job role and queue, an S3 event or a call after
  upload confirmation to start the job, a job-complete event (EventBridge,
  like IVS) that records the HLS manifest on the content row, an `hls.js`
  player for browsers without native HLS, and signed access to the manifest
  and segments (CloudFront signed cookies are the usual way, so Option 1
  comes first).
- Not built. Nothing has been created.

## Recommendation

Launch with progressive MP4 as built, and ask artists to export H.264 MP4.
Add CloudFront (Option 1) when the first video drop is close, since it cuts
delivery cost to about zero at launch volumes. Add MediaConvert (Option 2)
only if fans report buffering on phones or artists need to upload formats
browsers can't play.

Sources: https://aws.amazon.com/mediaconvert/pricing,
https://aws.amazon.com/cloudfront/pricing/pay-as-you-go
